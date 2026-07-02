import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useDb } from './DbContext';
import { getPendientesSync } from '../database/queries/sync';
import { subirDatosPendientes, descargarDatosNube } from '../services/syncService';
import { authErrorState } from '../services/supabaseClient';

const SyncContext = createContext(null);

/**
 * Hook personalizado para consumir el estado global de sincronización.
 */
export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync debe ser utilizado dentro de un SyncProvider');
  }
  return context;
}

/**
 * Proveedor de contexto global de sincronización.
 */
export function SyncProvider({ children }) {
  const { db, isReady } = useDb();
  const [pendientesCount, setPendientesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Función asíncrona para consultar y actualizar el conteo local de pendientes
  const actualizarConteo = useCallback(async () => {
    if (!db || !isReady) return 0;
    try {
      const pendientes = await getPendientesSync(db);
      const total = pendientes.productos + pendientes.ventas + pendientes.detalle_ventas;
      setPendientesCount(total);
      return total;
    } catch (error) {
      console.warn('[SyncContext] Error al actualizar conteo de pendientes:', error);
      return 0;
    }
  }, [db, isReady]);

  // Función asíncrona para ejecutar el proceso completo de sincronización bidireccional
  const ejecutarSincronizacion = useCallback(async () => {
    if (!db || isSyncing) return;
    if (authErrorState === 'credentials_error') {
      Alert.alert(
        'Error de Credenciales',
        'La sincronización está pausada porque las credenciales de Supabase son incorrectas. Por favor, corrígelas en el menú de Configuración.',
      );
      return;
    }

    setIsSyncing(true);
    try {
      const totalPendientes = await actualizarConteo();
      if (totalPendientes > 0) {
        // Subida (Push) y luego Descarga (Pull)
        await subirDatosPendientes(db);
        await descargarDatosNube(db);
      } else {
        // Solo Descarga (Pull)
        await descargarDatosNube(db);
      }
      // Actualizar el conteo final después de la sincronización
      await actualizarConteo();
    } catch (error) {
      console.error('[SyncContext] Error al ejecutar sincronización:', error);
      Alert.alert(
        'Error de Sincronización',
        error.message || 'No se pudo completar la sincronización.',
      );
    } finally {
      setIsSyncing(false);
    }
  }, [db, isSyncing, actualizarConteo]);

  // Cargar conteo inicial una vez que la base de datos esté lista
  useEffect(() => {
    if (isReady && db) {
      actualizarConteo();
    }
  }, [isReady, db, actualizarConteo]);

  return (
    <SyncContext.Provider
      value={{
        pendientesCount,
        isSyncing,
        actualizarConteo,
        ejecutarSincronizacion,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export default SyncContext;
