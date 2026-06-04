/**
 * Crea las tablas e índices iniciales en la base de datos dentro de una transacción.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de la base de datos de expo-sqlite
 * @returns {Promise<void>}
 */
export async function createSchema(db) {
  try {
    await db.execAsync(`
      BEGIN TRANSACTION;

      CREATE TABLE IF NOT EXISTS productos (
          id TEXT PRIMARY KEY NOT NULL,
          nombre TEXT NOT NULL,
          precio_cents INTEGER NOT NULL,
          is_variable INTEGER DEFAULT 0,
          is_custom INTEGER DEFAULT 0,
          orden_prioridad INTEGER DEFAULT 0,
          activo INTEGER DEFAULT 1,
          is_synced INTEGER DEFAULT 0,
          updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_productos_pos ON productos(activo, orden_prioridad);

      CREATE TABLE IF NOT EXISTS ventas (
          id TEXT PRIMARY KEY NOT NULL,
          fecha_venta TEXT NOT NULL,
          fecha_registro TEXT NOT NULL,
          turno TEXT NOT NULL,
          aula TEXT NOT NULL,
          total_cents INTEGER NOT NULL,
          estado_pago INTEGER DEFAULT 0,
          anulado_at TEXT,
          motivo_anulacion TEXT,
          is_synced INTEGER DEFAULT 0,
          updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ventas_reportes ON ventas(estado_pago, anulado_at, fecha_venta, aula);
      CREATE INDEX IF NOT EXISTS idx_ventas_sync ON ventas(is_synced);

      CREATE TABLE IF NOT EXISTS detalle_ventas (
          id TEXT PRIMARY KEY NOT NULL,
          venta_id TEXT NOT NULL,
          producto_id TEXT,
          producto_nombre TEXT NOT NULL,
          cantidad INTEGER NOT NULL,
          precio_unitario_cents INTEGER NOT NULL,
          subtotal_cents INTEGER NOT NULL,
          detalle_multiplicador TEXT,
          FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_detalle_venta_id ON detalle_ventas(venta_id);

      CREATE TABLE IF NOT EXISTS medios_pago (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          banco_nombre TEXT NOT NULL,
          qr_image_path TEXT NOT NULL,
          descripcion TEXT
      );

      CREATE TABLE IF NOT EXISTS app_config (
          key TEXT PRIMARY KEY,
          value TEXT
      );

      INSERT OR IGNORE INTO app_config (key, value) VALUES ('db_version', '4');
      INSERT OR IGNORE INTO app_config (key, value) VALUES ('turno_activo', 'Mañana');
      INSERT OR IGNORE INTO app_config (key, value) VALUES ('ultimo_backup', NULL);

      COMMIT;
    `);
  } catch (error) {
    try {
      await db.execAsync('ROLLBACK;');
    } catch (rollbackError) {
      // Ignorar error de rollback si la transacción ya se revirtió
    }
    throw error;
  }
}
