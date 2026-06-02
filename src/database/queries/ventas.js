/**
 * Inserta una venta completa (cabecera + detalles) en una sola transacción atómica.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {Object} params Parámetros de la venta
 * @param {Object} params.venta Datos de la cabecera de venta
 * @param {string} params.venta.id UUID de la venta
 * @param {string} params.venta.fecha_venta Fecha real: "YYYY-MM-DD"
 * @param {string} params.venta.fecha_registro Timestamp ISO 8601
 * @param {string} params.venta.turno "Mañana" | "Tarde"
 * @param {string} params.venta.aula Aula (ej: "3° A")
 * @param {number} params.venta.total_cents Total de la venta en centavos (INTEGER)
 * @param {number} [params.venta.estado_pago] 0 = Pendiente | 1 = Pagado
 * @param {number} [params.venta.is_synced] 0 = No synced | 1 = Synced
 * @param {string} params.venta.updated_at Timestamp ISO 8601
 * @param {Array<Object>} params.detalles Array con las líneas de detalle
 * @param {string} params.detalles[].id UUID del detalle
 * @param {string} params.detalles[].venta_id UUID de la venta asociada
 * @param {string|null} params.detalles[].producto_id UUID del producto en catálogo o null
 * @param {string} params.detalles[].producto_nombre Nombre del producto
 * @param {number} params.detalles[].cantidad Cantidad (INTEGER)
 * @param {number} params.detalles[].precio_unitario_cents Precio unitario en centavos (INTEGER)
 * @param {number} params.detalles[].subtotal_cents Subtotal en centavos (cantidad * precio_unitario_cents)
 * @returns {Promise<void>}
 */
export async function insertarVenta(db, { venta, detalles }) {
  try {
    await db.withTransactionAsync(async () => {
      // 1. Insertar cabecera
      await db.runAsync(
        `INSERT INTO ventas (
          id, fecha_venta, fecha_registro, turno, aula, total_cents, estado_pago, anulado_at, motivo_anulacion, is_synced, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          venta.id,
          venta.fecha_venta,
          venta.fecha_registro,
          venta.turno,
          venta.aula,
          venta.total_cents,
          venta.estado_pago ?? 0,
          venta.anulado_at ?? null,
          venta.motivo_anulacion ?? null,
          venta.is_synced ?? 0,
          venta.updated_at
        ]
      );

      // 2. Insertar detalles
      for (const det of detalles) {
        await db.runAsync(
          `INSERT INTO detalle_ventas (
            id, venta_id, producto_id, producto_nombre, cantidad, precio_unitario_cents, subtotal_cents
          ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            det.id,
            venta.id, // forzar que coincida con la cabecera
            det.producto_id,
            det.producto_nombre,
            det.cantidad,
            det.precio_unitario_cents,
            det.subtotal_cents
          ]
        );
      }
    });
  } catch (error) {
    console.error('[DB Query] Error al insertar venta:', error);
    throw error;
  }
}

/**
 * Obtiene todas las ventas activas (no anuladas) de un aula específica en un mes específico.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {Object} params
 * @param {string} params.aula Grado y sección (ej: "3° A")
 * @param {string} params.mes Formato "YYYY-MM"
 * @returns {Promise<Array<Object>>} Ventas del aula en ese mes
 */
export async function getVentasPorAula(db, { aula, mes }) {
  try {
    return await db.getAllAsync(
      `SELECT * FROM ventas
       WHERE aula = ?
         AND strftime('%Y-%m', fecha_venta) = ?
         AND anulado_at IS NULL
       ORDER BY fecha_venta DESC, fecha_registro DESC;`,
      [aula, mes]
    );
  } catch (error) {
    console.error('[DB Query] Error en getVentasPorAula:', error);
    throw error;
  }
}

/**
 * Anula una venta de forma lógica (soft delete).
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {Object} params
 * @param {string} params.id UUID de la venta
 * @param {string} params.motivo Motivo de la anulación
 * @returns {Promise<void>}
 */
export async function anularVenta(db, { id, motivo }) {
  try {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE ventas
       SET anulado_at = ?,
           motivo_anulacion = ?,
           is_synced = 0,
           updated_at = ?
       WHERE id = ?;`,
      [now, motivo, now, id]
    );
  } catch (error) {
    console.error('[DB Query] Error al anular venta:', error);
    throw error;
  }
}

/**
 * Marca una lista de ventas como pagadas.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {Object} params
 * @param {Array<string>} params.ventaIds Lista de UUIDs de las ventas
 * @returns {Promise<void>}
 */
export async function marcarComoPagado(db, { ventaIds }) {
  try {
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      for (const id of ventaIds) {
        await db.runAsync(
          `UPDATE ventas
           SET estado_pago = 1,
               is_synced = 0,
               updated_at = ?
           WHERE id = ?;`,
          [now, id]
        );
      }
    });
  } catch (error) {
    console.error('[DB Query] Error al marcar ventas como pagadas:', error);
    throw error;
  }
}

/**
 * Obtiene las líneas de detalle asociadas a una venta específica.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {string} ventaId UUID de la venta
 * @returns {Promise<Array<Object>>} Detalles de la venta
 */
export async function getDetalleVenta(db, ventaId) {
  try {
    return await db.getAllAsync(
      `SELECT * FROM detalle_ventas WHERE venta_id = ?;`,
      [ventaId]
    );
  } catch (error) {
    console.error('[DB Query] Error en getDetalleVenta:', error);
    throw error;
  }
}

/**
 * Obtiene las ventas que aún no se han sincronizado con la nube (is_synced = 0).
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {number} [limit] Límite de registros a recuperar
 * @returns {Promise<Array<Object>>} Ventas no sincronizadas
 */
export async function getVentasSinSync(db, limit = 100) {
  try {
    return await db.getAllAsync(
      `SELECT * FROM ventas WHERE is_synced = 0 LIMIT ?;`,
      [limit]
    );
  } catch (error) {
    console.error('[DB Query] Error en getVentasSinSync:', error);
    throw error;
  }
}
