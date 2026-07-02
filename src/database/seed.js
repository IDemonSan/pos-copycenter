/**
 * Inserta los productos iniciales si la tabla de productos está vacía.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de la base de datos de expo-sqlite
 * @returns {Promise<void>}
 */
export async function seedProductos(db) {
  try {
    const row = await db.getFirstAsync('SELECT COUNT(*) as count FROM productos;');
    const count = row?.count ?? 0;

    if (count === 0) {
      const now = new Date().toISOString();
      const PRODUCTOS_INICIALES = [
        {
          id: 'prod-001',
          nombre: 'Copia B/N A4',
          precio_cents: 10,
          is_variable: 0,
          orden_prioridad: 1,
          activo: 1,
        },
        {
          id: 'prod-002',
          nombre: 'Copia color A4',
          precio_cents: 30,
          is_variable: 0,
          orden_prioridad: 2,
          activo: 1,
        },
        {
          id: 'prod-003',
          nombre: 'Copia B/N A3',
          precio_cents: 100,
          is_variable: 0,
          orden_prioridad: 3,
          activo: 1,
        },
        {
          id: 'prod-004',
          nombre: 'Copia color A3',
          precio_cents: 200,
          is_variable: 0,
          orden_prioridad: 4,
          activo: 1,
        },
        {
          id: 'prod-005',
          nombre: 'Impresión simple',
          precio_cents: 30,
          is_variable: 0,
          orden_prioridad: 5,
          activo: 1,
        },
        {
          id: 'prod-006',
          nombre: 'Impresión A4',
          precio_cents: 50,
          is_variable: 0,
          orden_prioridad: 5,
          activo: 1,
        },
        {
          id: 'prod-007',
          nombre: 'Impresión A4 color',
          precio_cents: 100,
          is_variable: 0,
          orden_prioridad: 5,
          activo: 1,
        },
      ];

      await db.execAsync('BEGIN TRANSACTION;');

      for (const prod of PRODUCTOS_INICIALES) {
        await db.runAsync(
          `INSERT OR IGNORE INTO productos (id, nombre, precio_cents, is_variable, orden_prioridad, activo, is_synced, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?);`,
          [
            prod.id,
            prod.nombre,
            prod.precio_cents,
            prod.is_variable,
            prod.orden_prioridad,
            prod.activo,
            now,
          ],
        );
      }

      await db.execAsync('COMMIT;');
      console.log('[DB] Seed de productos completado correctamente.');
    }
  } catch (error) {
    try {
      await db.execAsync('ROLLBACK;');
    } catch (rollbackError) {
      // Ignorar si ya se revirtió
    }
    console.error('[DB] Error en seed de productos:', error);
    throw error;
  }
}
