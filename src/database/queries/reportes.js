/**
 * Obtiene el resumen del día: total vendido y desglose por aula.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {string} fecha Fecha en formato "YYYY-MM-DD"
 * @returns {Promise<{ total_dia_cents: number, por_aula: Array<{ aula: string, total_cents: number }> }>} Resumen del día
 */
export async function getResumenDia(db, fecha) {
  try {
    const totalRes = await db.getFirstAsync(
      `SELECT COALESCE(SUM(total_cents), 0) as total_dia_cents
       FROM ventas
       WHERE fecha_venta = ?
         AND anulado_at IS NULL;`,
      [fecha]
    );

    const porAula = await db.getAllAsync(
      `SELECT aula, COALESCE(SUM(total_cents), 0) as total_cents
       FROM ventas
       WHERE fecha_venta = ?
         AND anulado_at IS NULL
       GROUP BY aula
       ORDER BY total_cents DESC;`,
      [fecha]
    );

    return {
      total_dia_cents: totalRes?.total_dia_cents ?? 0,
      por_aula: porAula
    };
  } catch (error) {
    console.error('[DB Query] Error en getResumenDia:', error);
    throw error;
  }
}

/**
 * Obtiene la deuda consolidada por aula para un mes específico.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {string} mes Mes en formato "YYYY-MM"
 * @returns {Promise<Array<{ aula: string, turno: string, deuda_cents: number, num_pedidos: number }>>} Deuda agrupada por aula
 */
export async function getDeudaPorAula(db, mes) {
  try {
    return await db.getAllAsync(
      `SELECT
         aula,
         turno,
         COALESCE(SUM(total_cents), 0) AS deuda_cents,
         COUNT(*) AS num_pedidos
       FROM ventas
       WHERE estado_pago = 0
         AND anulado_at IS NULL
         AND strftime('%Y-%m', fecha_venta) = ?
       GROUP BY aula, turno
       ORDER BY deuda_cents DESC;`,
      [mes]
    );
  } catch (error) {
    console.error('[DB Query] Error en getDeudaPorAula:', error);
    throw error;
  }
}

/**
 * Obtiene la deuda total acumulada por un aula específica en un mes.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {Object} params
 * @param {string} params.aula Aula (ej: "3° A")
 * @param {string} params.mes Mes en formato "YYYY-MM"
 * @returns {Promise<{ deuda_cents: number }>} Deuda del aula
 */
export async function getDeudaAula(db, { aula, mes }) {
  try {
    const res = await db.getFirstAsync(
      `SELECT COALESCE(SUM(total_cents), 0) AS deuda_cents
       FROM ventas
       WHERE aula = ?
         AND estado_pago = 0
         AND anulado_at IS NULL
         AND strftime('%Y-%m', fecha_venta) = ?;`,
      [aula, mes]
    );
    return {
      deuda_cents: res?.deuda_cents ?? 0
    };
  } catch (error) {
    console.error('[DB Query] Error en getDeudaAula:', error);
    throw error;
  }
}
