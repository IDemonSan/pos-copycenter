import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { insertarVenta } from '../database/queries/ventas';
import {
  hapticProductoAgregado,
  hapticVentaConfirmada,
  hapticBufferVacio,
  hapticError,
} from '../services/hapticService';
import { recalcularPendientes } from '../services/syncWorker';
import { simplificarExpresion } from '../utils/expresiones';

/**
 * Generador de UUIDs v4 compatible para entornos React Native/Expo.
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const MAX_DIGITS = 4;

/**
 * Convierte un término de expresión a su representación textual.
 * Ej: {multiplicando:30, multiplicador:3} → "30x3"
 *     {multiplicando:15, multiplicador:null} → "15"
 */
function termToStr(term) {
  return term.multiplicador != null
    ? `${term.multiplicando}x${term.multiplicador}`
    : `${term.multiplicando}`;
}

/**
 * Calcula el total de unidades de una expresión compuesta.
 * Ej: [{30,3}, {15,null}] → 30*3 + 15 = 105
 */
function calcularTotal(expresiones, current) {
  let total = 0;
  for (const expr of expresiones) {
    total +=
      expr.multiplicador != null ? expr.multiplicando * expr.multiplicador : expr.multiplicando;
  }
  // Agregar término actual si existe
  if (current.multiplicando > 0) {
    total +=
      current.multiplicador != null
        ? current.multiplicando * current.multiplicador
        : current.multiplicando;
  }
  return total;
}

/**
 * Construye el string detalle_multiplicador para la BD.
 * Ej: [{30,3}, {15,null}] → "30x3+15"
 */
function buildExpressionStr(expresiones, current) {
  const parts = [];
  for (const expr of expresiones) {
    parts.push(termToStr(expr));
  }
  if (current.multiplicando > 0) {
    parts.push(termToStr(current));
  }
  return parts.join('+');
}

/**
 * Hook personalizado que encapsula toda la lógica del carrito de compras y
 * el buffer numérico del POS, separada de la capa de UI.
 *
 * Soporta expresiones compuestas con los operadores × (multiplicación) y + (suma).
 * Ej: "30×3+15" = (30×3) + 15 = 105 unidades.
 * Además, los productos con el mismo producto_id se fusionan automáticamente.
 *
 * @param {import('expo-sqlite').SQLiteDatabase} db - Instancia de la base de datos
 * @param {Function} actualizarConteo - Callback para actualizar el contador de sync
 * @returns {Object} Estado y acciones del carrito
 */
export default function useCarrito(db, actualizarConteo) {
  // ─── Estado del carrito de compras ────────────────────────────────────────
  const [carrito, setCarrito] = useState([]);
  const [isGuardando, setIsGuardando] = useState(false);

  // ─── Estado del buffer de expresiones ────────────────────────────────────
  // expresiones: términos ya finalizados (ej: [{30,3}] después de presionar +)
  const [expresiones, setExpresiones] = useState([]);
  // Término actual que se está editando
  const [currentMultiplicando, setCurrentMultiplicando] = useState('');
  const [currentMultiplicador, setCurrentMultiplicador] = useState('');
  const [isModoMultiplicacion, setIsModoMultiplicacion] = useState(false);

  // ─── Señal de shake para ProductButton ───────────────────────────────────
  const [shakeSignal, setShakeSignal] = useState(0);

  // ─── Valor visual del buffer ──────────────────────────────────────────────
  // Muestra toda la expresión compuesta: "30×3 + 15"
  const displayBuffer = (() => {
    const partes = [];

    // Expresiones finalizadas
    for (const expr of expresiones) {
      if (expr.multiplicador != null) {
        partes.push(`${expr.multiplicando}×${expr.multiplicador}`);
      } else {
        partes.push(`${expr.multiplicando}`);
      }
    }

    // Término actual
    if (
      expresiones.length > 0 &&
      (currentMultiplicando || isModoMultiplicacion || currentMultiplicador)
    ) {
      if (isModoMultiplicacion) {
        partes.push(`${currentMultiplicando}×${currentMultiplicador || ''}`);
      } else {
        partes.push(currentMultiplicando);
      }
    } else if (expresiones.length === 0) {
      if (isModoMultiplicacion) {
        partes.push(`${currentMultiplicando}×${currentMultiplicador || ''}`);
      } else if (currentMultiplicando) {
        partes.push(currentMultiplicando);
      }
    }

    return partes.join(' + ');
  })();

  // ─── Total del carrito ────────────────────────────────────────────────────
  const totalCarritoCents = carrito.reduce((sum, item) => sum + item.subtotal_cents, 0);

  // ─── Ayuda: obtener objeto current como término ──────────────────────────
  const getCurrentTerm = useCallback(() => {
    const mul = parseInt(currentMultiplicando, 10);
    if (!currentMultiplicando || isNaN(mul) || mul === 0) return null;

    if (isModoMultiplicacion && currentMultiplicador) {
      const mul2 = parseInt(currentMultiplicador, 10);
      if (isNaN(mul2) || mul2 === 0) return null;
      return { multiplicando: mul, multiplicador: mul2 };
    }

    return { multiplicando: mul, multiplicador: null };
  }, [currentMultiplicando, isModoMultiplicacion, currentMultiplicador]);

  // ─── Lógica del pad ──────────────────────────────────────────────────────

  const handleNumberPress = useCallback(
    (digit) => {
      if (!isModoMultiplicacion) {
        setCurrentMultiplicando((prev) => (prev.length < MAX_DIGITS ? prev + digit : prev));
      } else {
        setCurrentMultiplicador((prev) => (prev.length < MAX_DIGITS ? prev + digit : prev));
      }
    },
    [isModoMultiplicacion],
  );

  const handleXPress = useCallback(() => {
    if (currentMultiplicando.length > 0) {
      setIsModoMultiplicacion(true);
    }
  }, [currentMultiplicando]);

  /**
   * Maneja el operador "+": finaliza el término actual y lo agrega
   * a la lista de expresiones, comenzando un nuevo término.
   */
  const handlePlusPress = useCallback(() => {
    const term = getCurrentTerm();
    if (!term) {
      // Si no hay término actual (buffer vacío), no hace nada
      hapticBufferVacio();
      setShakeSignal((prev) => prev + 1);
      return;
    }

    setExpresiones((prev) => [...prev, term]);
    setCurrentMultiplicando('');
    setCurrentMultiplicador('');
    setIsModoMultiplicacion(false);
  }, [getCurrentTerm]);

  const handleBackspace = useCallback(() => {
    if (isModoMultiplicacion) {
      if (currentMultiplicador.length > 0) {
        setCurrentMultiplicador((prev) => prev.slice(0, -1));
      } else {
        setIsModoMultiplicacion(false);
      }
    } else if (currentMultiplicando.length > 0) {
      setCurrentMultiplicando((prev) => prev.slice(0, -1));
    } else if (expresiones.length > 0) {
      // Si el término actual está vacío y hay expresiones guardadas,
      // retrocede al último término guardado
      const ultima = expresiones[expresiones.length - 1];
      setExpresiones((prev) => prev.slice(0, -1));
      setCurrentMultiplicando(String(ultima.multiplicando));
      if (ultima.multiplicador != null) {
        setCurrentMultiplicador(String(ultima.multiplicador));
        setIsModoMultiplicacion(true);
      } else {
        setCurrentMultiplicador('');
        setIsModoMultiplicacion(false);
      }
    }
  }, [isModoMultiplicacion, currentMultiplicando, currentMultiplicador, expresiones]);

  const limpiarBuffer = useCallback(() => {
    setExpresiones([]);
    setCurrentMultiplicando('');
    setCurrentMultiplicador('');
    setIsModoMultiplicacion(false);
  }, []);

  // ─── Merge interno: fusiona líneas del mismo producto ─────────────────

  /**
   * Función interna: si ya existe un item con el mismo producto_id en el carrito
   * y NO es un producto personalizado/variable, lo fusiona (suma cantidades,
   * concatena expresiones). Si no, agrega uno nuevo.
   * Los productos custom se excluyen del merge porque cada instancia tiene
   * nombre y precio únicos (ej: "Anillado color" vs "Empastado").
   */
  const mergeOrAddAlCarrito = useCallback((nuevaLinea) => {
    setCarrito((prev) => {
      // Products personalizados/variables usan producto_id único para evitar merge
      // (generado con UUID en agregarAlCarritoCustom/conPrecio)
      const idx = prev.findIndex((item) => item.id === nuevaLinea.id);
      if (idx >= 0) {
        // Mismo UUID → ya existe, no duplicar
        return prev;
      }

      // Para productos de precio fijo, buscar por producto_id
      const existingIdx = prev.findIndex(
        (item) => item.producto_id === nuevaLinea.producto_id && item.id !== nuevaLinea.id,
      );

      if (existingIdx === -1) {
        // No existe → agregar nuevo
        return [...prev, nuevaLinea];
      }

      // Existe → fusionar (solo para productos de precio fijo)
      const updated = [...prev];
      const existing = { ...updated[existingIdx] };
      const nuevaCantidad = existing.cantidad + nuevaLinea.cantidad;
      const nuevoSubtotal = existing.subtotal_cents + nuevaLinea.subtotal_cents;

      // Simplificar expresiones: si ambas tienen el mismo multiplicando, se factorizan
      // ej: "30x3" + "30" → "30x4"
      const exprA = existing.detalle_multiplicador || '';
      const exprB = nuevaLinea.detalle_multiplicador || '';
      let nuevaExpr;
      if (exprA && exprB) {
        nuevaExpr = simplificarExpresion(exprA, exprB).expresion;
      } else {
        nuevaExpr = exprA || exprB;
      }

      updated[existingIdx] = {
        ...existing,
        cantidad: nuevaCantidad,
        subtotal_cents: nuevoSubtotal,
        detalle_multiplicador: nuevaExpr || null,
      };

      return updated;
    });
  }, []);

  // ─── Agregar producto al carrito (con merge automático) ─────────────────

  const agregarAlCarrito = useCallback(
    (producto) => {
      // 1. Obtener el término actual
      const currentTerm = getCurrentTerm();

      // Si no hay término actual ni expresiones guardadas, usar 1 como default
      const hasNoInput = expresiones.length === 0 && currentMultiplicando === '';
      if (hasNoInput) {
        // Caso especial: buffer vacío → agregar 1 unidad del producto
        if (producto.is_custom) {
          return {
            needsCustom: true,
            producto,
            totalUnidades: 1,
            multiplicadorInfo: null,
          };
        }
        if (producto.is_variable) {
          return {
            needsPrice: true,
            producto,
            totalUnidades: 1,
            multiplicadorInfo: null,
          };
        }

        const nuevaLinea = {
          id: generateUUID(),
          producto_id: producto.id,
          producto_nombre: producto.nombre,
          cantidad: 1,
          precio_unitario_cents: producto.precio_cents,
          subtotal_cents: producto.precio_cents,
          detalle_multiplicador: null,
        };

        mergeOrAddAlCarrito(nuevaLinea);
        limpiarBuffer();
        hapticProductoAgregado();
        return;
      }

      // 2. Validar el término actual
      if (currentTerm) {
        const valido =
          currentTerm.multiplicador != null
            ? currentTerm.multiplicando > 0 && currentTerm.multiplicador > 0
            : currentTerm.multiplicando > 0;

        if (!valido) {
          hapticBufferVacio();
          setShakeSignal((prev) => prev + 1);
          return;
        }
      }

      // 3. Construir expresión completa
      const todasLasExpresiones = [...expresiones, ...(currentTerm ? [currentTerm] : [])];

      const totalUnidades = calcularTotal(expresiones, currentTerm || { multiplicando: 0 });
      const multiplicadorInfo = buildExpressionStr(
        expresiones,
        currentTerm || { multiplicando: 0 },
      );

      // 4. Validar total
      if (totalUnidades <= 0) {
        hapticBufferVacio();
        setShakeSignal((prev) => prev + 1);
        return;
      }

      // 5. Producto personalizado o variable → retornar info para modal
      if (producto.is_custom) {
        return {
          needsCustom: true,
          producto,
          totalUnidades,
          multiplicadorInfo,
        };
      }

      if (producto.is_variable) {
        return {
          needsPrice: true,
          producto,
          totalUnidades,
          multiplicadorInfo,
        };
      }

      // 6. Producto de precio fijo → agregar al carrito
      const subtotal_cents = totalUnidades * producto.precio_cents;

      const nuevaLinea = {
        id: generateUUID(),
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        cantidad: totalUnidades,
        precio_unitario_cents: producto.precio_cents,
        subtotal_cents,
        detalle_multiplicador: multiplicadorInfo,
      };

      mergeOrAddAlCarrito(nuevaLinea);
      limpiarBuffer();
      hapticProductoAgregado();
    },
    [expresiones, getCurrentTerm, limpiarBuffer, mergeOrAddAlCarrito],
  );

  // Versión para productos de precio variable (con modal)
  const agregarAlCarritoConPrecio = useCallback(
    ({ producto, totalUnidades, multiplicadorInfo, precioUnitarioCents }) => {
      const subtotal_cents = totalUnidades * precioUnitarioCents;

      const nuevaLinea = {
        id: generateUUID(),
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        cantidad: totalUnidades,
        precio_unitario_cents: precioUnitarioCents,
        subtotal_cents,
        detalle_multiplicador: multiplicadorInfo,
      };

      mergeOrAddAlCarrito(nuevaLinea);
      limpiarBuffer();
      hapticProductoAgregado();
    },
    [mergeOrAddAlCarrito, limpiarBuffer],
  );

  // Versión para productos personalizados
  const agregarAlCarritoCustom = useCallback(
    ({ producto, nombreCustom, totalUnidades, multiplicadorInfo, precioUnitarioCents }) => {
      const subtotal_cents = totalUnidades * precioUnitarioCents;

      const nuevaLinea = {
        id: generateUUID(),
        producto_id: producto.id,
        producto_nombre: nombreCustom,
        cantidad: totalUnidades,
        precio_unitario_cents: precioUnitarioCents,
        subtotal_cents,
        detalle_multiplicador: multiplicadorInfo,
      };

      mergeOrAddAlCarrito(nuevaLinea);
      limpiarBuffer();
      hapticProductoAgregado();
    },
    [mergeOrAddAlCarrito, limpiarBuffer],
  );

  // ─── Quitar del carrito ───────────────────────────────────────────────────

  const quitarDelCarrito = useCallback((itemId) => {
    setCarrito((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const limpiarCarrito = useCallback(() => {
    setCarrito([]);
    limpiarBuffer();
  }, [limpiarBuffer]);

  // ─── Confirmar venta ─────────────────────────────────────────────────────

  const confirmarVenta = useCallback(
    async ({ aula, turno, fechaVenta }) => {
      if (carrito.length === 0) return;
      if (!aula) {
        Alert.alert('Falta el aula', 'Selecciona un aula antes de confirmar la venta.');
        return;
      }

      setIsGuardando(true);
      try {
        const ventaId = generateUUID();
        const ahora = new Date().toISOString();

        const venta = {
          id: ventaId,
          fecha_venta: fechaVenta,
          fecha_registro: ahora,
          turno,
          aula,
          total_cents: carrito.reduce((sum, item) => sum + item.subtotal_cents, 0),
          estado_pago: 0,
          anulado_at: null,
          motivo_anulacion: null,
          is_synced: 0,
          updated_at: ahora,
        };

        const detalles = carrito.map((item) => ({
          ...item,
          venta_id: ventaId,
        }));

        await insertarVenta(db, { venta, detalles });

        await recalcularPendientes(db);
        if (actualizarConteo) {
          await actualizarConteo();
        }

        hapticVentaConfirmada();
        limpiarCarrito();
      } catch (error) {
        hapticError();
        Alert.alert('Error', 'No se pudo guardar la venta. Intenta de nuevo.');
        console.error('[useCarrito] Error al confirmar venta:', error);
      } finally {
        setIsGuardando(false);
      }
    },
    [carrito, db, limpiarCarrito, actualizarConteo],
  );

  return {
    // Estado del carrito
    carrito,
    totalCarritoCents,
    isGuardando,

    // Estado del buffer
    displayBuffer,
    isModoMultiplicacion,
    shakeSignal,

    // Acciones del buffer
    handleNumberPress,
    handleXPress,
    handlePlusPress,
    handleBackspace,
    limpiarBuffer,

    // Acciones del carrito
    agregarAlCarrito,
    agregarAlCarritoConPrecio,
    agregarAlCarritoCustom,
    quitarDelCarrito,
    limpiarCarrito,
    confirmarVenta,
  };
}
