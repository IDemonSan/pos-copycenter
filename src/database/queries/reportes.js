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
      [fecha],
    );

    const porAula = await db.getAllAsync(
      `SELECT aula, COALESCE(SUM(total_cents), 0) as total_cents
       FROM ventas
       WHERE fecha_venta = ?
         AND anulado_at IS NULL
       GROUP BY aula
       ORDER BY total_cents DESC;`,
      [fecha],
    );

    return {
      total_dia_cents: totalRes?.total_dia_cents ?? 0,
      por_aula: porAula,
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
         CASE
           WHEN aula LIKE '%C' THEN 'Tarde'
           ELSE 'Mañana'
         END AS turno,
         COALESCE(SUM(total_cents - COALESCE(pagado_cents, 0)), 0) AS deuda_cents,
         COUNT(*) AS num_pedidos
       FROM ventas
       WHERE total_cents > COALESCE(pagado_cents, 0)
         AND anulado_at IS NULL
         AND strftime('%Y-%m', fecha_venta) = ?
       GROUP BY aula
       ORDER BY deuda_cents DESC;`,
      [mes],
    );
  } catch (error) {
    console.error('[DB Query] Error en getDeudaPorAula:', error);
    throw error;
  }
}

/**
 * Obtiene el total vendido de un día específico (para ayer/otros días).
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @param {string} fecha Fecha "YYYY-MM-DD"
 * @returns {Promise<{ total_cents: number, pedidos: number }>}
 */
export async function getTotalPorDia(db, fecha) {
  try {
    const res = await db.getFirstAsync(
      `SELECT COALESCE(SUM(total_cents), 0) as total_cents,
              COUNT(*) as pedidos
       FROM ventas
       WHERE fecha_venta = ?
         AND anulado_at IS NULL;`,
      [fecha],
    );
    return {
      total_cents: res?.total_cents ?? 0,
      pedidos: res?.pedidos ?? 0,
    };
  } catch (error) {
    console.error('[DB Query] Error en getTotalPorDia:', error);
    throw error;
  }
}

/**
 * Obtiene el total vendido en un mes completo (todas las aulas).
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @param {string} mes Mes "YYYY-MM"
 * @returns {Promise<{ total_cents: number, pedidos: number }>}
 */
export async function getTotalPorMes(db, mes) {
  try {
    const res = await db.getFirstAsync(
      `SELECT COALESCE(SUM(total_cents), 0) as total_cents,
              COUNT(*) as pedidos
       FROM ventas
       WHERE strftime('%Y-%m', fecha_venta) = ?
         AND anulado_at IS NULL;`,
      [mes],
    );
    return {
      total_cents: res?.total_cents ?? 0,
      pedidos: res?.pedidos ?? 0,
    };
  } catch (error) {
    console.error('[DB Query] Error en getTotalPorMes:', error);
    throw error;
  }
}

/**
 * Obtiene el total vendido en el mes anterior para comparativa mensual.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @param {string} mesActual Mes actual "YYYY-MM"
 * @returns {Promise<{ total_cents: number, mes: string }>}
 */
export async function getTotalMesAnterior(db, mesActual) {
  try {
    const [year, month] = mesActual.split('-').map(Number);
    const d = new Date(year, month - 2, 1); // Mes anterior (month-2 porque month es 1-based)
    const mesAnterior = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const res = await db.getFirstAsync(
      `SELECT COALESCE(SUM(total_cents), 0) as total_cents
       FROM ventas
       WHERE strftime('%Y-%m', fecha_venta) = ?
         AND anulado_at IS NULL;`,
      [mesAnterior],
    );

    return {
      total_cents: res?.total_cents ?? 0,
      mes: mesAnterior,
    };
  } catch (error) {
    console.error('[DB Query] Error en getTotalMesAnterior:', error);
    throw error;
  }
}

/**
 * Obtiene el detalle día por día de un mes completo.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @param {string} mes Mes "YYYY-MM"
 * @returns {Promise<Array<{ dia: string, total_cents: number, pedidos: number }>>}
 */
export async function getVentasPorDiaDelMes(db, mes) {
  try {
    return await db.getAllAsync(
      `SELECT fecha_venta as dia,
              COALESCE(SUM(total_cents), 0) as total_cents,
              COUNT(*) as pedidos
       FROM ventas
       WHERE strftime('%Y-%m', fecha_venta) = ?
         AND anulado_at IS NULL
       GROUP BY fecha_venta
       ORDER BY fecha_venta ASC;`,
      [mes],
    );
  } catch (error) {
    console.error('[DB Query] Error en getVentasPorDiaDelMes:', error);
    throw error;
  }
}

/**
 * Obtiene el total vendido por cada mes de un año.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @param {number} anio Año (ej: 2026)
 * @returns {Promise<Array<{ mes: string, total_cents: number, pedidos: number }>>}
 */
export async function getVentasPorMesDelAnio(db, anio) {
  try {
    return await db.getAllAsync(
      `SELECT strftime('%Y-%m', fecha_venta) as mes,
              COALESCE(SUM(total_cents), 0) as total_cents,
              COUNT(*) as pedidos
       FROM ventas
       WHERE strftime('%Y', fecha_venta) = ?
         AND anulado_at IS NULL
       GROUP BY strftime('%Y-%m', fecha_venta)
       ORDER BY mes ASC;`,
      [String(anio)],
    );
  } catch (error) {
    console.error('[DB Query] Error en getVentasPorMesDelAnio:', error);
    throw error;
  }
}

/**
 * Obtiene las ventas de un día específico agrupadas por aula,
 * con el detalle de productos de cada venta.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @param {string} fecha Fecha "YYYY-MM-DD"
 * @returns {Promise<Array<{ venta_id: string, aula: string, turno: string, total_cents: number, estado_pago: number, productos: string }>>}
 */
export async function getVentasDelDiaAgrupadas(db, fecha) {
  try {
    const ventas = await db.getAllAsync(
      `SELECT v.id as venta_id,
              v.aula,
              CASE WHEN v.aula LIKE '%C' THEN 'Tarde' ELSE 'Mañana' END as turno,
              v.total_cents,
              v.estado_pago,
              (SELECT GROUP_CONCAT(d.cantidad || 'x ' || d.producto_nombre, ', ')
               FROM detalle_ventas d WHERE d.venta_id = v.id) as productos
       FROM ventas v
       WHERE v.fecha_venta = ?
         AND v.anulado_at IS NULL
       ORDER BY v.aula ASC;`,
      [fecha],
    );
    return ventas;
  } catch (error) {
    console.error('[DB Query] Error en getVentasDelDiaAgrupadas:', error);
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
      `SELECT COALESCE(SUM(total_cents - COALESCE(pagado_cents, 0)), 0) AS deuda_cents
       FROM ventas
       WHERE aula = ?
         AND total_cents > COALESCE(pagado_cents, 0)
         AND anulado_at IS NULL
         AND strftime('%Y-%m', fecha_venta) = ?;`,
      [aula, mes],
    );
    return {
      deuda_cents: res?.deuda_cents ?? 0,
    };
  } catch (error) {
    console.error('[DB Query] Error en getDeudaAula:', error);
    throw error;
  }
}
