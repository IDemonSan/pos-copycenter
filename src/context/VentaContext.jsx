import React, { createContext, useContext, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useDb } from './DbContext';
import { useSync } from './SyncContext';
import useCarrito from '../hooks/useCarrito';

const VentaContext = createContext(null);

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

  // ─── Lógica del carrito separada en hook personalizado ──────────────────
  const carritoHook = useCarrito(db, actualizarConteo);

  // ─── Estado de contexto de venta ─────────────────────────────────────────
  const [aulaSeleccionada, setAulaSeleccionada] = useState('');
  const [turnoActivo, setTurnoActivo] = useState('Mañana');
  const [fechaVenta, setFechaVentaState] = useState(obtenerFechaLocal());

  // Override de confirmarVenta que inyecta aula, turno y fecha automáticamente
  const confirmarVentaConContexto = useCallback(async () => {
    await carritoHook.confirmarVenta({
      aula: aulaSeleccionada,
      turno: turnoActivo,
      fechaVenta,
    });
  }, [carritoHook.confirmarVenta, aulaSeleccionada, turnoActivo, fechaVenta]);

  // ─── Setters ─────────────────────────────────────────────────────────────

  const setAula = useCallback((aula) => setAulaSeleccionada(aula), []);

  const setTurno = useCallback((turno) => {
    setTurnoActivo(turno);
  }, []);

  const setFechaVenta = useCallback((fecha) => {
    const hoy = new Date().toISOString().slice(0, 10);

    if (fecha > hoy) {
      Alert.alert('Fecha no válida', 'No puedes registrar ventas con fecha futura.');
      return;
    }

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
        ],
      );
      return;
    }

    setFechaVentaState(fecha);
  }, []);

  const recargarTurno = useCallback(async () => {
    if (!db) return;
    const result = await db.getFirstAsync(
      "SELECT value FROM app_config WHERE key = 'turno_activo'",
    );
    if (result?.value) setTurnoActivo(result.value);
  }, [db]);

  return (
    <VentaContext.Provider
      value={{
        // Estado del carrito (desde hook)
        carrito: carritoHook.carrito,
        totalCarritoCents: carritoHook.totalCarritoCents,
        isGuardando: carritoHook.isGuardando,

        // Estado del pad (desde hook)
        displayBuffer: carritoHook.displayBuffer,
        isModoMultiplicacion: carritoHook.isModoMultiplicacion,
        shakeSignal: carritoHook.shakeSignal,

        // Acciones del pad (desde hook)
        handleNumberPress: carritoHook.handleNumberPress,
        handleXPress: carritoHook.handleXPress,
        handlePlusPress: carritoHook.handlePlusPress,
        handleBackspace: carritoHook.handleBackspace,
        limpiarBuffer: carritoHook.limpiarBuffer,

        // Acciones del carrito (desde hook)
        agregarAlCarrito: carritoHook.agregarAlCarrito,
        agregarAlCarritoConPrecio: carritoHook.agregarAlCarritoConPrecio,
        agregarAlCarritoCustom: carritoHook.agregarAlCarritoCustom,
        quitarDelCarrito: carritoHook.quitarDelCarrito,
        limpiarCarrito: carritoHook.limpiarCarrito,

        // confirmarVenta envuelto con contexto de venta
        confirmarVenta: confirmarVentaConContexto,

        // Contexto de la venta
        aulaSeleccionada,
        turnoActivo,
        fechaVenta,
        setAula,
        setTurno,
        setFechaVenta,
        recargarTurno,
      }}
    >
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
  const fecha = new Date(fechaISO + 'T12:00:00');
  return fecha.toLocaleDateString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}
