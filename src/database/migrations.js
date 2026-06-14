/**
 * Versión actual del esquema en el código de la aplicación.
 */
export const CODE_DB_VERSION = 5;

/**
 * Lista de migraciones ordenadas secuencialmente por versión.
 * Para la versión 1 inicial, este array está vacío.
 * @type {Array<{version: number, run: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>}>}
 */
const MIGRATIONS = [
  {
    version: 2,
    run: async (db) => {
      await db.execAsync(`
        BEGIN TRANSACTION;

        ALTER TABLE detalle_ventas
        ADD COLUMN detalle_multiplicador TEXT;

        UPDATE app_config
        SET value = '2'
        WHERE key = 'db_version';

        COMMIT;
      `);
    }
  },
  {
    version: 3,
    run: async (db) => {
      await db.execAsync(`
        BEGIN TRANSACTION;

        CREATE TABLE IF NOT EXISTS medios_pago (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            banco_nombre TEXT NOT NULL,
            qr_image_path TEXT NOT NULL,
            descripcion TEXT
        );

        UPDATE app_config
        SET value = '3'
        WHERE key = 'db_version';

        COMMIT;
      `);
    }
  },
  {
    version: 4,
    run: async (db) => {
      await db.execAsync(`
        BEGIN TRANSACTION;

        ALTER TABLE productos
        ADD COLUMN is_custom INTEGER DEFAULT 0;

        UPDATE app_config
        SET value = '4'
        WHERE key = 'db_version';

        COMMIT;
      `);
    }
  },
  {
    version: 5,
    run: async (db) => {
      // Verificar si la columna ya existe (pudo haber sido agregada por autocuración)
      const columns = await db.getAllAsync("PRAGMA table_info(ventas);");
      const hasPagadoCents = columns.some(col => col.name === 'pagado_cents');

      await db.execAsync(`
        BEGIN TRANSACTION;

        ${hasPagadoCents ? 'SELECT 1;' : 'ALTER TABLE ventas ADD COLUMN pagado_cents INTEGER DEFAULT 0;'}

        UPDATE app_config
        SET value = '5'
        WHERE key = 'db_version';

        COMMIT;
      `);
    }
  }
];

/**
 * Ejecuta todas las migraciones de base de datos pendientes secuencialmente.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de la base de datos de expo-sqlite
 * @returns {Promise<void>}
 */
export async function runMigrations(db) {
  // --- AUTOCURACIÓN / VERIFICACIÓN DE SEGURIDAD ---
  // Verifica y repara columnas/tablas que pudieron haber quedado inconsistentes
  try {
    // 1. Verificar columna detalle_multiplicador en detalle_ventas
    const columnsDetalle = await db.getAllAsync("PRAGMA table_info(detalle_ventas);");
    const hasMultiplicador = columnsDetalle.some(col => col.name === 'detalle_multiplicador');
    if (!hasMultiplicador) {
      await db.execAsync("ALTER TABLE detalle_ventas ADD COLUMN detalle_multiplicador TEXT;");
      console.log("[DB Autocuración] Columna detalle_multiplicador añadida a detalle_ventas.");
    }

    // 2. Verificar columna is_custom en productos
    const columnsProductos = await db.getAllAsync("PRAGMA table_info(productos);");
    const hasIsCustom = columnsProductos.some(col => col.name === 'is_custom');
    if (!hasIsCustom) {
      await db.execAsync("ALTER TABLE productos ADD COLUMN is_custom INTEGER DEFAULT 0;");
      console.log("[DB Autocuración] Columna is_custom añadida a productos.");
    }

    // 3. Verificar columna pagado_cents en ventas
    const columnsVentas = await db.getAllAsync("PRAGMA table_info(ventas);");
    const hasPagadoCents = columnsVentas.some(col => col.name === 'pagado_cents');
    if (!hasPagadoCents) {
      await db.execAsync("ALTER TABLE ventas ADD COLUMN pagado_cents INTEGER DEFAULT 0;");
      console.log("[DB Autocuración] Columna pagado_cents añadida a ventas.");
    }

    // 4. Verificar existencia de tabla medios_pago
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS medios_pago (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          banco_nombre TEXT NOT NULL,
          qr_image_path TEXT NOT NULL,
          descripcion TEXT
      );
    `);
  } catch (e) {
    console.error("[DB Autocuración] Error durante verificación estructural:", e);
  }

  const result = await db.getFirstAsync(
    "SELECT value FROM app_config WHERE key = 'db_version';"
  );
  
  const currentVersion = parseInt(result?.value ?? '1', 10);
  
  const pendingMigrations = MIGRATIONS.filter(m => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pendingMigrations) {
    try {
      await migration.run(db);
      console.log(`[DB] Migración V${migration.version} aplicada correctamente.`);
    } catch (error) {
      try {
        await db.execAsync('ROLLBACK;');
      } catch (rollbackError) {
        // Ignorar si ya se revirtió
      }
      console.error(`[DB] Migración V${migration.version} falló. Base de datos sin cambios.`, error);
      throw error;
    }
  }
}
