/**
 * Versión actual del esquema en el código de la aplicación.
 */
export const CODE_DB_VERSION = 1;

/**
 * Lista de migraciones ordenadas secuencialmente por versión.
 * Para la versión 1 inicial, este array está vacío.
 * @type {Array<{version: number, run: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>}>}
 */
const MIGRATIONS = [
  // Ejemplo de migración futura:
  // {
  //   version: 2,
  //   run: async (db) => {
  //     await db.execAsync(`
  //       BEGIN TRANSACTION;
  //       ALTER TABLE productos ADD COLUMN descuento_cents INTEGER DEFAULT 0;
  //       UPDATE app_config SET value = '2' WHERE key = 'db_version';
  //       COMMIT;
  //     `);
  //   }
  // }
];

/**
 * Ejecuta todas las migraciones de base de datos pendientes secuencialmente.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de la base de datos de expo-sqlite
 * @returns {Promise<void>}
 */
export async function runMigrations(db) {
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
