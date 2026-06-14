/**
 * Obtiene el conteo de registros pendientes de sincronización por tabla.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @returns {Promise<{ productos: number, ventas: number, detalle_ventas: number }>} Conteo por tabla
 */
export async function getPendientesSync(db) {
  try {
    const prodRes = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM productos WHERE is_synced = 0;"
    );
    const ventasRes = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM ventas WHERE is_synced = 0;"
    );
    // detalle_ventas se considera pendiente si su venta asociada no está sincronizada
    const detRes = await db.getFirstAsync(
      `SELECT COUNT(*) as count
       FROM detalle_ventas d
       JOIN ventas v ON d.venta_id = v.id
       WHERE v.is_synced = 0;`
    );

    return {
      productos: prodRes?.count ?? 0,
      ventas: ventasRes?.count ?? 0,
      detalle_ventas: detRes?.count ?? 0
    };
  } catch (error) {
    console.error('[DB Query] Error en getPendientesSync:', error);
    throw error;
  }
}

/**
 * Obtiene un lote de ventas sin sincronizar (máximo 100).
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @returns {Promise<Array<Object>>} Ventas sin sincronizar
 */
export async function getLoteVentasSinSync(db) {
  try {
    return await db.getAllAsync(
      "SELECT * FROM ventas WHERE is_synced = 0 LIMIT 100;"
    );
  } catch (error) {
    console.error('[DB Query] Error en getLoteVentasSinSync:', error);
    throw error;
  }
}

/**
 * Obtiene un lote de productos sin sincronizar (máximo 100).
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @returns {Promise<Array<Object>>} Productos sin sincronizar
 */
export async function getLoteProductosSinSync(db) {
  try {
    return await db.getAllAsync(
      "SELECT * FROM productos WHERE is_synced = 0 LIMIT 100;"
    );
  } catch (error) {
    console.error('[DB Query] Error en getLoteProductosSinSync:', error);
    throw error;
  }
}

/**
 * Obtiene un lote de detalles de ventas sin sincronizar (máximo 100).
 * Basado en las ventas que aún no han sido sincronizadas.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @returns {Promise<Array<Object>>} Detalles de venta sin sincronizar
 */
export async function getLoteDetallesSinSync(db) {
  try {
    return await db.getAllAsync(
      `SELECT d.*
       FROM detalle_ventas d
       JOIN ventas v ON d.venta_id = v.id
       WHERE v.is_synced = 0
       LIMIT 100;`
    );
  } catch (error) {
    console.error('[DB Query] Error en getLoteDetallesSinSync:', error);
    throw error;
  }
}

/**
 * Tablas permitidas para marcar como sincronizadas.
 * Sirve como whitelist para prevenir SQL injection.
 */
const TABLAS_SYNC_PERMITIDAS = ['productos', 'ventas'];

/**
 * Marca un lote de registros como sincronizados en la tabla correspondiente.
 * Nota: Dado que detalle_ventas no tiene columna is_synced en el schema físico,
 * si se recibe 'detalle_ventas' no realiza operación de actualización directa en esa tabla.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {Object} params
 * @param {string} params.tabla Nombre de la tabla ('productos' | 'ventas' | 'detalle_ventas')
 * @param {Array<string>} params.ids Lista de IDs a marcar como sincronizados
 * @returns {Promise<void>}
 */
export async function marcarSincronizados(db, { tabla, ids }) {
  if (!ids || ids.length === 0) return;

  // Validar que la tabla esté en la whitelist para prevenir SQL injection
  if (!TABLAS_SYNC_PERMITIDAS.includes(tabla)) {
    // detalle_ventas no tiene columna is_synced según el schema.
    if (tabla === 'detalle_ventas') {
      return;
    }
    console.warn(`[DB Query] Tabla "${tabla}" no permitida para marcar sincronizados.`);
    return;
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE ${tabla}
       SET is_synced = 1
       WHERE id IN (${placeholders});`,
      ids
    );
  } catch (error) {
    console.error(`[DB Query] Error al marcar sincronizados en ${tabla}:`, error);
    throw error;
  }
}
