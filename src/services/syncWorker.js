import NetInfo from '@react-native-community/netinfo';
import { supabase, asegurarAutenticacion } from './supabaseClient';
import { sessionActiva } from './authService';
import {
  getLoteProductosSinSync,
  getLoteVentasSinSync,
  getPendientesSync,
  marcarSincronizados,
} from '../database/queries/sync';

let syncEnCurso = false;
let pendientesCount = 0;
let onPendientesChange = null;

/**
 * Registra el callback de actualización del contador de pendientes.
 * @param {(count: number) => void} callback
 */
export function setSyncCallback(callback) {
  onPendientesChange = callback;
  // Inicialmente reportar el último contador
  callback(pendientesCount);
}

/**
 * Obtiene la cantidad de registros actualmente pendientes de sincronizar.
 * @returns {number}
 */
export function getPendientesCount() {
  return pendientesCount;
}

/**
 * Recalcula de forma asíncrona la cantidad de registros pendientes de sincronización.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @returns {Promise<number>}
 */
export async function recalcularPendientes(db) {
  try {
    if (db) {
      const pendientes = await getPendientesSync(db);
      pendientesCount = pendientes.productos + pendientes.ventas + pendientes.detalle_ventas;
      onPendientesChange?.(pendientesCount);
      return pendientesCount;
    }
  } catch (error) {
    console.warn('[SyncWorker] Error al recalcular pendientes:', error);
  }
  return pendientesCount;
}

/**
 * Inicializa el monitor de conectividad a la red.
 * Ejecuta la sincronización en background automáticamente al detectar red WiFi y sesión activa.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 */
export function initSyncWorker(db) {
  // Listener de cambios de red
  NetInfo.addEventListener(async (state) => {
    const tieneWifi = state.isConnected && state.type === 'wifi';
    if (tieneWifi && !syncEnCurso) {
      await ejecutarSync(db);
    }
  });

  // Ejecución inicial asíncrona no bloqueante del conteo
  setTimeout(async () => {
    try {
      if (db) {
        const pendientes = await getPendientesSync(db);
        pendientesCount = pendientes.productos + pendientes.ventas + pendientes.detalle_ventas;
        onPendientesChange?.(pendientesCount);
      }
    } catch (e) {
      console.warn('[SyncWorker] Error al calcular pendientes iniciales:', e);
    }
  }, 1000);
}

/**
 * Fuerza o ejecuta manualmente el ciclo de sincronización.
 */
export async function ejecutarSync(db) {
  if (!supabase || !db || syncEnCurso) return;

  // Realizar inicio de sesión automático usando las credenciales guardadas antes de consultar/enviar datos
  const isAuth = await asegurarAutenticacion();
  if (!isAuth) {
    console.warn('[SyncWorker] No se puede sincronizar: el cliente de Supabase no está autenticado.');
    return;
  }

  syncEnCurso = true;

  try {
    // 1. Sincronizar productos primero
    await sincronizarProductos(db);

    // 2. Sincronizar ventas y detalles manteniendo integridad de FKs
    await sincronizarVentasYDetalles(db);

    // 3. Recalcular pendientes y notificar
    const pendientes = await getPendientesSync(db);
    pendientesCount = pendientes.productos + pendientes.ventas + pendientes.detalle_ventas;
    onPendientesChange?.(pendientesCount);

  } catch (error) {
    console.warn('[SyncWorker] Error durante la sincronización:', error.message);
  } finally {
    syncEnCurso = false;
  }
}

/**
 * Sincroniza productos por lotes.
 */
async function sincronizarProductos(db) {
  let hayMas = true;
  while (hayMas) {
    const lote = await getLoteProductosSinSync(db);
    if (lote.length === 0) {
      hayMas = false;
      break;
    }

    const loteConSync = lote.map(r => ({ ...r, is_synced: 1 }));
    const { error } = await supabase
      .from('productos')
      .upsert(loteConSync, { onConflict: 'id' });

    if (error) {
      console.warn('[SyncWorker] Error al subir productos:', error.message);
      throw error;
    }

    const ids = lote.map(r => r.id);
    await marcarSincronizados(db, { tabla: 'productos', ids });

    hayMas = lote.length === 100;
  }
}

/**
 * Sincroniza ventas y luego sus detalles asociados para respetar las dependencias FK de PostgreSQL.
 * Actualiza is_synced en la base local una vez completada con éxito la carga de ambos.
 */
async function sincronizarVentasYDetalles(db) {
  let hayMas = true;
  while (hayMas) {
    const ventasLote = await getLoteVentasSinSync(db);
    if (ventasLote.length === 0) {
      hayMas = false;
      break;
    }

    // A. Subir cabeceras de ventas
    const ventasConSync = ventasLote.map(v => ({ ...v, is_synced: 1 }));
    const { error: ventasError } = await supabase
      .from('ventas')
      .upsert(ventasConSync, { onConflict: 'id' });

    if (ventasError) {
      console.warn('[SyncWorker] Error al subir ventas:', ventasError.message);
      throw ventasError;
    }

    // B. Obtener detalles para este lote específico de ventas
    const ventaIds = ventasLote.map(v => v.id);
    const placeholders = ventaIds.map(() => '?').join(',');
    const detallesLote = await db.getAllAsync(
      `SELECT * FROM detalle_ventas WHERE venta_id IN (${placeholders});`,
      ventaIds
    );

    if (detallesLote.length > 0) {
      // Subir líneas de detalle
      const { error: detallesError } = await supabase
        .from('detalle_ventas')
        .upsert(detallesLote, { onConflict: 'id' });

      if (detallesError) {
        console.warn('[SyncWorker] Error al subir detalle_ventas:', detallesError.message);
        throw detallesError;
      }
    }

    // C. Marcar ventas locales como sincronizadas una vez que cabecera y detalles están seguros en la nube
    await marcarSincronizados(db, { tabla: 'ventas', ids: ventaIds });

    hayMas = ventasLote.length === 100;
  }
}
