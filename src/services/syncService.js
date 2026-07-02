import { supabase, asegurarAutenticacion } from './supabaseClient';
import {
  getLoteProductosSinSync,
  getLoteVentasSinSync,
  marcarSincronizados,
} from '../database/queries/sync';

/**
 * Sube todos los registros pendientes (is_synced = 0) a Supabase.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @returns {Promise<{ productos: number, ventas: number }>}
 */
export async function subirDatosPendientes(db) {
  if (!supabase || !db) throw new Error('Cliente Supabase o Base de Datos no inicializada.');

  // Asegurar autenticación activa
  const isAuth = await asegurarAutenticacion();
  if (!isAuth) throw new Error('No autorizado. Verifica las credenciales de la nube.');

  let countProductos = 0;
  let countVentas = 0;

  // 1. Sincronizar productos
  let hayMasProds = true;
  while (hayMasProds) {
    const lote = await getLoteProductosSinSync(db);
    if (lote.length === 0) {
      hayMasProds = false;
      break;
    }
    const loteConSync = lote.map((r) => ({ ...r, is_synced: 1 }));
    const { error } = await supabase.from('productos').upsert(loteConSync, { onConflict: 'id' });

    if (error) {
      console.error('[SyncService] Error al subir lote productos:', error.message);
      throw error;
    }

    const ids = lote.map((r) => r.id);
    await marcarSincronizados(db, { tabla: 'productos', ids });
    countProductos += lote.length;

    hayMasProds = lote.length === 100;
  }

  // 2. Sincronizar ventas y detalles
  let hayMasVentas = true;
  while (hayMasVentas) {
    const ventasLote = await getLoteVentasSinSync(db);
    if (ventasLote.length === 0) {
      hayMasVentas = false;
      break;
    }

    // A. Subir cabeceras
    const ventasConSync = ventasLote.map((v) => ({ ...v, is_synced: 1 }));
    const { error: ventasError } = await supabase
      .from('ventas')
      .upsert(ventasConSync, { onConflict: 'id' });

    if (ventasError) {
      console.error('[SyncService] Error al subir lote ventas:', ventasError.message);
      throw ventasError;
    }

    // B. Obtener detalles para este lote
    const ventaIds = ventasLote.map((v) => v.id);
    const placeholders = ventaIds.map(() => '?').join(',');
    const detallesLote = await db.getAllAsync(
      `SELECT * FROM detalle_ventas WHERE venta_id IN (${placeholders});`,
      ventaIds,
    );

    if (detallesLote.length > 0) {
      const { error: detallesError } = await supabase
        .from('detalle_ventas')
        .upsert(detallesLote, { onConflict: 'id' });

      if (detallesError) {
        console.error('[SyncService] Error al subir lote detalle_ventas:', detallesError.message);
        throw detallesError;
      }
    }

    await marcarSincronizados(db, { tabla: 'ventas', ids: ventaIds });
    countVentas += ventasLote.length;

    hayMasVentas = ventasLote.length === 100;
  }

  return { productos: countProductos, ventas: countVentas };
}

/**
 * Descarga y restaura el histórico desde Supabase a la base local de SQLite.
 * Verifica registros locales y sobrescribe únicamente si los de la nube son más recientes.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @returns {Promise<{ productos: { creados: number, actualizados: number }, ventas: { creados: number, actualizados: number }, detalles: { creados: number, actualizados: number } }>}
 */
export async function descargarDatosNube(db) {
  if (!supabase || !db) throw new Error('Cliente Supabase o Base de Datos no inicializada.');

  // Asegurar autenticación activa
  const isAuth = await asegurarAutenticacion();
  if (!isAuth) throw new Error('No autorizado. Verifica las credenciales de la nube.');

  // 1. Descargar datos históricos de Supabase
  const { data: prodsNube, error: errorProds } = await supabase.from('productos').select('*');
  if (errorProds) throw errorProds;

  const { data: ventasNube, error: errorVentas } = await supabase.from('ventas').select('*');
  if (errorVentas) throw errorVentas;

  const { data: detallesNube, error: errorDetalles } = await supabase
    .from('detalle_ventas')
    .select('*');
  if (errorDetalles) throw errorDetalles;

  let insertadosProd = 0,
    actualizadosProd = 0;
  let insertadosVenta = 0,
    actualizadosVenta = 0;
  let insertadosDet = 0,
    actualizadosDet = 0;

  // 2. Transacción de integración en SQLite
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    // A. Integración de Productos
    for (const p of prodsNube || []) {
      const localProd = await db.getFirstAsync(
        'SELECT id, updated_at FROM productos WHERE id = ?;',
        [p.id],
      );
      if (!localProd) {
        await db.runAsync(
          `INSERT INTO productos (id, nombre, precio_cents, is_variable, is_custom, orden_prioridad, activo, is_synced, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?);`,
          [
            p.id,
            p.nombre,
            p.precio_cents,
            p.is_variable,
            p.is_custom,
            p.orden_prioridad,
            p.activo,
            p.updated_at,
          ],
        );
        insertadosProd++;
      } else {
        if (new Date(p.updated_at) > new Date(localProd.updated_at)) {
          await db.runAsync(
            `UPDATE productos
             SET nombre = ?, precio_cents = ?, is_variable = ?, is_custom = ?, orden_prioridad = ?, activo = ?, is_synced = 1, updated_at = ?
             WHERE id = ?;`,
            [
              p.nombre,
              p.precio_cents,
              p.is_variable,
              p.is_custom,
              p.orden_prioridad,
              p.activo,
              p.updated_at,
              p.id,
            ],
          );
          actualizadosProd++;
        }
      }
    }

    // B. Integración de Ventas
    for (const v of ventasNube || []) {
      const localVenta = await db.getFirstAsync('SELECT id, updated_at FROM ventas WHERE id = ?;', [
        v.id,
      ]);
      if (!localVenta) {
        await db.runAsync(
          `INSERT INTO ventas (id, fecha_venta, fecha_registro, turno, aula, total_cents, estado_pago, anulado_at, motivo_anulacion, is_synced, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?);`,
          [
            v.id,
            v.fecha_venta,
            v.fecha_registro,
            v.turno,
            v.aula,
            v.total_cents,
            v.estado_pago,
            v.anulado_at,
            v.motivo_anulacion,
            v.updated_at,
          ],
        );
        insertadosVenta++;
      } else {
        if (new Date(v.updated_at) > new Date(localVenta.updated_at)) {
          await db.runAsync(
            `UPDATE ventas
             SET fecha_venta = ?, fecha_registro = ?, turno = ?, aula = ?, total_cents = ?, estado_pago = ?, anulado_at = ?, motivo_anulacion = ?, is_synced = 1, updated_at = ?
             WHERE id = ?;`,
            [
              v.fecha_venta,
              v.fecha_registro,
              v.turno,
              v.aula,
              v.total_cents,
              v.estado_pago,
              v.anulado_at,
              v.motivo_anulacion,
              v.updated_at,
              v.id,
            ],
          );
          actualizadosVenta++;
        }
      }
    }

    // C. Integración de Detalle Ventas
    for (const d of detallesNube || []) {
      const localDetalle = await db.getFirstAsync('SELECT id FROM detalle_ventas WHERE id = ?;', [
        d.id,
      ]);
      if (!localDetalle) {
        await db.runAsync(
          `INSERT INTO detalle_ventas (id, venta_id, producto_id, producto_nombre, cantidad, precio_unitario_cents, subtotal_cents, detalle_multiplicador)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            d.id,
            d.venta_id,
            d.producto_id,
            d.producto_nombre,
            d.cantidad,
            d.precio_unitario_cents,
            d.subtotal_cents,
            d.detalle_multiplicador,
          ],
        );
        insertadosDet++;
      } else {
        await db.runAsync(
          `UPDATE detalle_ventas
           SET venta_id = ?, producto_id = ?, producto_nombre = ?, cantidad = ?, precio_unitario_cents = ?, subtotal_cents = ?, detalle_multiplicador = ?
           WHERE id = ?;`,
          [
            d.venta_id,
            d.producto_id,
            d.producto_nombre,
            d.cantidad,
            d.precio_unitario_cents,
            d.subtotal_cents,
            d.detalle_multiplicador,
            d.id,
          ],
        );
        actualizadosDet++;
      }
    }

    await db.execAsync('COMMIT;');
  } catch (txError) {
    try {
      await db.execAsync('ROLLBACK;');
    } catch (_) {}
    throw txError;
  }

  return {
    productos: { creados: insertadosProd, actualizados: actualizadosProd },
    ventas: { creados: insertadosVenta, actualizados: actualizadosVenta },
    detalles: { creados: insertadosDet, actualizados: actualizadosDet },
  };
}
