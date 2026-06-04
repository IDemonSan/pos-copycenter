import React, { createContext, useContext, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useDb } from './DbContext';
import { insertarVenta } from '../database/queries/ventas';
import {
  hapticProductoAgregado,
  hapticVentaConfirmada,
  hapticBufferVacio,
  hapticError,
} from '../services/hapticService';
import { recalcularPendientes } from '../services/syncWorker';
import { useSync } from './SyncContext';

const VentaContext = createContext(null);

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

const obtenerFechaLocal = () => {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

export function VentaProvider({ children }) {
  const { db } = useDb();
  const { actualizarConteo } = useSync();

  // ─── Estado del carrito de compras ────────────────────────────────────────
  const [carrito, setCarrito] = useState([]);
  const [isGuardando, setIsGuardando] = useState(false);

  // ─── Estado del pad numérico ─────────────────────────────────────────────
  // bufferMultiplicando: primera cantidad (ej: "37")
  // bufferMultiplicador: segunda cantidad (ej: "5"), solo activa en modo x
  // isModoMultiplicacion: true cuando el usuario presionó X
  const [bufferMultiplicando, setBufferMultiplicando] = useState('');
  const [bufferMultiplicador, setBufferMultiplicador] = useState('');
  const [isModoMultiplicacion, setIsModoMultiplicacion] = useState(false);

  // ─── Estado de contexto de venta ─────────────────────────────────────────
  const [aulaSeleccionada, setAulaSeleccionada] = useState('');
  const [turnoActivo, setTurnoActivo] = useState('Mañana');
  const [fechaVenta, setFechaVentaState] = useState(obtenerFechaLocal());

  // ─── Señal de shake para ProductButton ───────────────────────────────────
  // Cada vez que sube en 1, el ProductButton dispara su animación de shake.
  const [shakeSignal, setShakeSignal] = useState(0);

  // ─── Valor visual del buffer (para mostrar en pantalla del POS) ──────────
  // Ejemplos:
  //   buffer vacío, sin modo x   → "1"  (default implícito)
  //   "37" sin modo x            → "37"
  //   "37" con modo x, sin mul   → "37 ×"
  //   "37" con modo x y "5"      → "37 × 5"
  const displayBuffer = isModoMultiplicacion
    ? `${bufferMultiplicando} ×${bufferMultiplicador ? ' ' + bufferMultiplicador : ''}`
    : bufferMultiplicando || '';

  // ─── Lógica del pad ──────────────────────────────────────────────────────

  const handleNumberPress = useCallback((digit) => {
    const MAX_DIGITS = 4; // Máximo 4 dígitos por buffer (9999 unidades)

    if (!isModoMultiplicacion) {
      setBufferMultiplicando(prev =>
        prev.length < MAX_DIGITS ? prev + digit : prev
      );
    } else {
      setBufferMultiplicador(prev =>
        prev.length < MAX_DIGITS ? prev + digit : prev
      );
    }
  }, [isModoMultiplicacion]);

  const handleXPress = useCallback(() => {
    // Solo activa el modo multiplicación si ya hay una cantidad ingresada
    if (bufferMultiplicando.length > 0) {
      setIsModoMultiplicacion(true);
    }
    // Si bufferMultiplicando está vacío, ignorar (no tiene sentido multiplicar desde 0)
  }, [bufferMultiplicando]);

  const handleBackspace = useCallback(() => {
    if (isModoMultiplicacion) {
      if (bufferMultiplicador.length > 0) {
        // Borrar último dígito del multiplicador
        setBufferMultiplicador(prev => prev.slice(0, -1));
      } else {
        // El multiplicador ya está vacío: salir del modo multiplicación
        setIsModoMultiplicacion(false);
      }
    } else {
      // Borrar último dígito del multiplicando
      setBufferMultiplicando(prev => prev.slice(0, -1));
    }
  }, [isModoMultiplicacion, bufferMultiplicador]);

  const limpiarBuffer = useCallback(() => {
    setBufferMultiplicando('');
    setBufferMultiplicador('');
    setIsModoMultiplicacion(false);
  }, []);

  // ─── Agregar producto al carrito ─────────────────────────────────────────

  const agregarAlCarrito = useCallback((producto) => {
    // Calcular cantidad total de unidades
    let totalUnidades;
    let multiplicadorInfo = null; // Para persistir en detalle_multiplicador

    if (isModoMultiplicacion && bufferMultiplicando && bufferMultiplicador) {
      const paquetes = parseInt(bufferMultiplicando, 10);
      const hojasPorPaquete = parseInt(bufferMultiplicador, 10);

      if (isNaN(paquetes) || isNaN(hojasPorPaquete) || paquetes === 0 || hojasPorPaquete === 0) {
        // Buffer inválido en modo multiplicación
        hapticBufferVacio();
        setShakeSignal(prev => prev + 1);
        return;
      }

      totalUnidades = paquetes * hojasPorPaquete;
      // Este string se guarda en detalle_multiplicador de la BD
      // y se muestra en PDF como "37 copias × 5 originales"
      multiplicadorInfo = `${paquetes}x${hojasPorPaquete}`;

    } else if (bufferMultiplicando) {
      // Modo simple: una sola cantidad
      const cantidad = parseInt(bufferMultiplicando, 10);
      if (isNaN(cantidad) || cantidad === 0) {
        hapticBufferVacio();
        setShakeSignal(prev => prev + 1);
        return;
      }
      totalUnidades = cantidad;

    } else {
      // Buffer completamente vacío → usar 1 como default implícito
      totalUnidades = 1;
    }

    // Si el producto es personalizado (nombre y precio editables en venta)
    if (producto.is_custom) {
      return {
        needsCustom: true,
        producto,
        totalUnidades,
        multiplicadorInfo,
      };
    }

    // Si el producto tiene precio variable, el POS screen se encarga
    // de mostrar el modal y llamar a agregarAlCarritoConPrecio directamente
    // Esta función solo maneja productos de precio fijo
    if (producto.is_variable) {
      // Retornar información para que POSScreen abra el modal
      return {
        needsPrice: true,
        producto,
        totalUnidades,
        multiplicadorInfo,
      };
    }

    const subtotal_cents = totalUnidades * producto.precio_cents;

    const nuevaLinea = {
      id: generateUUID(),
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      cantidad: totalUnidades,
      precio_unitario_cents: producto.precio_cents,
      subtotal_cents,
      detalle_multiplicador: multiplicadorInfo, // null si no se usó modo x
    };

    setCarrito(prev => [...prev, nuevaLinea]);
    limpiarBuffer();
    hapticProductoAgregado();
  }, [isModoMultiplicacion, bufferMultiplicando, bufferMultiplicador, limpiarBuffer]);

  // Versión para productos de precio variable (llamada desde POSScreen tras el modal)
  const agregarAlCarritoConPrecio = useCallback(({
    producto,
    totalUnidades,
    multiplicadorInfo,
    precioUnitarioCents,
  }) => {
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

    setCarrito(prev => [...prev, nuevaLinea]);
    limpiarBuffer();
    hapticProductoAgregado();
  }, [limpiarBuffer]);

  // Versión para productos personalizados (nombre y precio editables)
  const agregarAlCarritoCustom = useCallback(({
    producto,
    nombreCustom,
    totalUnidades,
    multiplicadorInfo,
    precioUnitarioCents,
  }) => {
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

    setCarrito(prev => [...prev, nuevaLinea]);
    limpiarBuffer();
    hapticProductoAgregado();
  }, [limpiarBuffer]);

  // ─── Quitar del carrito ───────────────────────────────────────────────────

  const quitarDelCarrito = useCallback((itemId) => {
    setCarrito(prev => prev.filter(item => item.id !== itemId));
  }, []);

  // ─── Confirmar venta ─────────────────────────────────────────────────────

  const confirmarVenta = useCallback(async () => {
    if (carrito.length === 0) return;
    if (!aulaSeleccionada) {
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
        turno: turnoActivo,
        aula: aulaSeleccionada,
        total_cents: carrito.reduce((sum, item) => sum + item.subtotal_cents, 0),
        estado_pago: 0,
        anulado_at: null,
        motivo_anulacion: null,
        is_synced: 0,
        updated_at: ahora,
      };

      // Añadir venta_id a cada línea del carrito
      const detalles = carrito.map(item => ({
        ...item,
        venta_id: ventaId,
      }));

      await insertarVenta(db, { venta, detalles });
      
      // Recalcular contador de pendientes en tiempo real
      await recalcularPendientes(db);
      await actualizarConteo();

      hapticVentaConfirmada();
      limpiarCarrito();
    } catch (error) {
      hapticError();
      Alert.alert('Error', 'No se pudo guardar la venta. Intenta de nuevo.');
      console.error('[VentaContext] Error al confirmar venta:', error);
    } finally {
      setIsGuardando(false);
    }
  }, [carrito, aulaSeleccionada, fechaVenta, turnoActivo, db, limpiarBuffer, actualizarConteo]);

  // ─── Setters ─────────────────────────────────────────────────────────────

  const setAula = useCallback((aula) => setAulaSeleccionada(aula), []);

  const setTurno = useCallback((turno) => {
    setTurnoActivo(turno);
  }, []);

  const setFechaVenta = useCallback((fecha) => {
    const hoy = new Date().toISOString().slice(0, 10);

    // Caso B: fecha futura — bloquear
    if (fecha > hoy) {
      Alert.alert(
        'Fecha no válida',
        'No puedes registrar ventas con fecha futura.'
      );
      return; // No actualiza el estado
    }

    // Caso A: fecha pasada — informar y permitir (Batch Entry)
    if (fecha < hoy) {
      Alert.alert(
        'Fecha anterior',
        `Estás registrando una venta con fecha ${formatearFechaLegible(fecha)}. ` +
        `Esto quedará marcado como transcripción.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar',
            onPress: () => setFechaVentaState(fecha),
          },
        ]
      );
      return; // La actualización ocurre solo si confirma
    }

    // Caso normal: fecha de hoy — actualizar directo sin alert
    setFechaVentaState(fecha);
  }, []);

  const limpiarCarrito = useCallback(() => {
    setCarrito([]);
    limpiarBuffer();
  }, [limpiarBuffer]);

  const recargarTurno = useCallback(async () => {
    if (!db) return;
    const result = await db.getFirstAsync(
      "SELECT value FROM app_config WHERE key = 'turno_activo'"
    );
    if (result?.value) setTurnoActivo(result.value);
  }, [db]);

  // ─── Total del carrito ────────────────────────────────────────────────────

  const totalCarritoCents = carrito.reduce((sum, item) => sum + item.subtotal_cents, 0);

  // ─── Valor expuesto ───────────────────────────────────────────────────────

  return (
    <VentaContext.Provider value={{
      // Estado del carrito
      carrito,
      totalCarritoCents,
      isGuardando,

      // Estado del pad
      displayBuffer,
      isModoMultiplicacion,
      shakeSignal,

      // Acciones del pad
      handleNumberPress,
      handleXPress,
      handleBackspace,

      // Acciones del carrito
      agregarAlCarrito,
      agregarAlCarritoConPrecio,
      agregarAlCarritoCustom,
      quitarDelCarrito,
      limpiarCarrito,
      confirmarVenta,

      // Contexto de la venta
      aulaSeleccionada,
      turnoActivo,
      fechaVenta,
      setAula,
      setTurno,
      setFechaVenta,
      recargarTurno,
    }}>
      {children}
    </VentaContext.Provider>
  );
}

export function useVenta() {
  const ctx = useContext(VentaContext);
  if (!ctx) throw new Error('useVenta debe usarse dentro de VentaProvider');
  return ctx;
}

// Helper: convierte "2025-06-01" a "dom. 1 de junio"
function formatearFechaLegible(fechaISO) {
  const fecha = new Date(fechaISO + 'T12:00:00'); // Mediodía para evitar desfase de timezone
  return fecha.toLocaleDateString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}
