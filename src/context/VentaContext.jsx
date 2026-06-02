import React, { createContext, useContext, useState, useEffect } from 'react';
import { insertarVenta } from '../database/queries/ventas';
import {
  hapticProductoAgregado,
  hapticVentaConfirmada,
  hapticBufferVacio,
  hapticError,
} from '../services/hapticService';

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

/**
 * Hook para consumir el contexto de venta activa.
 */
export function useVenta() {
  return useContext(VentaContext);
}

/**
 * Proveedor del contexto de venta activa.
 */
export function VentaProvider({ children, db }) {
  const [carrito, setCarrito] = useState([]);
  const [bufferCantidad, setBufferCantidad] = useState('');
  const [aulaSeleccionada, setAulaSeleccionada] = useState('');
  const [turnoActivo, setTurnoActivo] = useState('Mañana');
  const [fechaVenta, setFechaVenta] = useState(new Date().toISOString().slice(0, 10));
  const [isGuardando, setIsGuardando] = useState(false);
  const [shakeSignals, setShakeSignals] = useState({});

  /**
   * Recarga el turno_activo desde la tabla app_config.
   */
  const recargarTurno = async (databaseInstance) => {
    if (!databaseInstance) return;
    try {
      const res = await databaseInstance.getFirstAsync(
        "SELECT value FROM app_config WHERE key = 'turno_activo';"
      );
      if (res && res.value) {
        setTurnoActivo(res.value);
      }
    } catch (err) {
      console.error('[VentaContext] Error al recargar turno:', err);
    }
  };

  useEffect(() => {
    if (db) {
      recargarTurno(db);
    }
  }, [db]);
  const agregarDigito = (digit) => {
    if (bufferCantidad.length >= 4) return;
    // Evitar ceros a la izquierda innecesarios
    if (bufferCantidad === '' && (digit === '0' || digit === '00')) return;
    setBufferCantidad((prev) => prev + digit);
  };

  /**
   * Borra el último dígito del buffer de cantidad.
   */
  const borrarDigito = () => {
    setBufferCantidad((prev) => prev.slice(0, -1));
  };

  /**
   * Intenta agregar un producto al carrito según la cantidad en el buffer.
   * @param {Object} producto
   * @returns {Promise<Object|null>} Retorna información si se necesita ingresar precio, o null/error
   */
  const agregarAlCarrito = async (producto) => {
    try {
      const cantidad = parseInt(bufferCantidad, 10);

      if (isNaN(cantidad) || cantidad === 0) {
        await hapticBufferVacio();
        setShakeSignals((prev) => ({
          ...prev,
          [producto.id]: (prev[producto.id] || 0) + 1,
        }));
        return { error: 'buffer_vacio' };
      }

      if (producto.is_variable === 1) {
        // Retorna indicación de que se necesita modal de precio variable
        return { needsPrice: true, producto, cantidad };
      }

      const subtotal_cents = cantidad * producto.precio_cents;
      const nuevaLinea = {
        id: generateUUID(),
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        cantidad,
        precio_unitario_cents: producto.precio_cents,
        subtotal_cents,
      };

      setCarrito((prev) => [...prev, nuevaLinea]);
      setBufferCantidad('');
      await hapticProductoAgregado();
      return null;
    } catch (error) {
      console.error('[VentaContext] Error en agregarAlCarrito:', error);
      await hapticError();
      return { error: error.message };
    }
  };

  /**
   * Agrega un producto de precio variable directamente tras confirmarse el precio.
   */
  const agregarProductoVariable = async (producto, cantidad, precioCents) => {
    try {
      const subtotal_cents = cantidad * precioCents;
      const nuevaLinea = {
        id: generateUUID(),
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        cantidad,
        precio_unitario_cents: precioCents,
        subtotal_cents,
      };

      setCarrito((prev) => [...prev, nuevaLinea]);
      setBufferCantidad('');
      await hapticProductoAgregado();
    } catch (error) {
      console.error('[VentaContext] Error en agregarProductoVariable:', error);
      await hapticError();
    }
  };

  /**
   * Quita una línea específica del carrito.
   */
  const quitarDelCarrito = (itemId) => {
    setCarrito((prev) => prev.filter((item) => item.id !== itemId));
  };

  /**
   * Limpia todo el carrito y el buffer de cantidad.
   */
  const limpiarCarrito = () => {
    setCarrito([]);
    setBufferCantidad('');
  };

  /**
   * Cambia la fecha de la venta validando que no sea una fecha futura.
   * @param {string} fecha Formato "YYYY-MM-DD"
   * @returns {boolean} true si se aplicó, false si fue rechazada
   */
  const cambiarFechaVenta = (fecha) => {
    const today = new Date().toISOString().slice(0, 10);
    if (fecha > today) {
      return false;
    }
    setFechaVenta(fecha);
    return true;
  };

  /**
   * Guarda la venta en la base de datos local SQLite.
   */
  const confirmarVenta = async () => {
    if (carrito.length === 0 || !aulaSeleccionada) {
      await hapticError();
      throw new Error('Faltan datos requeridos (carrito vacío o aula no seleccionada).');
    }

    setIsGuardando(true);
    const now = new Date().toISOString();
    const totalCents = carrito.reduce((sum, item) => sum + item.subtotal_cents, 0);

    const venta = {
      id: generateUUID(),
      fecha_venta: fechaVenta,
      fecha_registro: now,
      turno: turnoActivo,
      aula: aulaSeleccionada,
      total_cents: totalCents,
      estado_pago: 0,
      anulado_at: null,
      motivo_anulacion: null,
      is_synced: 0,
      updated_at: now,
    };

    try {
      await insertarVenta(db, { venta, detalles: carrito });
      await hapticVentaConfirmada();
      limpiarCarrito();
    } catch (error) {
      await hapticError();
      console.error('[VentaContext] Error al guardar venta en DB:', error);
      throw error;
    } finally {
      setIsGuardando(false);
    }
  };

  return (
    <VentaContext.Provider
      value={{
        carrito,
        bufferCantidad,
        aulaSeleccionada,
        turnoActivo,
        fechaVenta,
        isGuardando,
        shakeSignals,
        agregarDigito,
        borrarDigito,
        agregarAlCarrito,
        agregarProductoVariable,
        quitarDelCarrito,
        confirmarVenta,
        setAula: setAulaSeleccionada,
        setTurno: setTurnoActivo,
        setFechaVenta: cambiarFechaVenta,
        limpiarCarrito,
        recargarTurno,
      }}
    >
      {children}
    </VentaContext.Provider>
  );
}
