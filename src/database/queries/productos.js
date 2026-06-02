/**
 * Obtiene todos los productos activos ordenados por orden_prioridad de forma ascendente.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @returns {Promise<Array<Object>>} Productos activos
 */
export async function getProductosActivos(db) {
  try {
    return await db.getAllAsync(
      `SELECT * FROM productos
       WHERE activo = 1
       ORDER BY orden_prioridad ASC;`
    );
  } catch (error) {
    console.error('[DB Query] Error en getProductosActivos:', error);
    throw error;
  }
}

/**
 * Obtiene todos los productos (activos e inactivos) para la pantalla de configuración.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @returns {Promise<Array<Object>>} Todos los productos
 */
export async function getTodosLosProductos(db) {
  try {
    return await db.getAllAsync(
      `SELECT * FROM productos
       ORDER BY orden_prioridad ASC;`
    );
  } catch (error) {
    console.error('[DB Query] Error en getTodosLosProductos:', error);
    throw error;
  }
}

/**
 * Inserta un producto nuevo.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {Object} producto Datos del producto a insertar
 * @param {string} producto.id UUID del producto
 * @param {string} producto.nombre Nombre del producto
 * @param {number} producto.precio_cents Precio en centavos (INTEGER)
 * @param {number} [producto.is_variable] 1 = precio variable, 0 = precio fijo
 * @param {number} [producto.orden_prioridad] Orden de prioridad
 * @param {number} [producto.activo] 1 = activo, 0 = inactivo
 * @returns {Promise<void>}
 */
export async function insertarProducto(db, producto) {
  try {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO productos (id, nombre, precio_cents, is_variable, orden_prioridad, activo, is_synced, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?);`,
      [
        producto.id,
        producto.nombre,
        producto.precio_cents,
        producto.is_variable ?? 0,
        producto.orden_prioridad ?? 0,
        producto.activo ?? 1,
        now
      ]
    );
  } catch (error) {
    console.error('[DB Query] Error al insertar producto:', error);
    throw error;
  }
}

/**
 * Actualiza un producto existente.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {Object} producto Datos del producto a actualizar
 * @param {string} producto.id UUID del producto
 * @param {string} producto.nombre Nombre del producto
 * @param {number} producto.precio_cents Precio en centavos
 * @param {number} producto.is_variable 1 o 0
 * @param {number} producto.orden_prioridad Orden de prioridad
 * @param {number} producto.activo 1 o 0
 * @returns {Promise<void>}
 */
export async function actualizarProducto(db, producto) {
  try {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE productos
       SET nombre = ?,
           precio_cents = ?,
           is_variable = ?,
           orden_prioridad = ?,
           activo = ?,
           is_synced = 0,
           updated_at = ?
       WHERE id = ?;`,
      [
        producto.nombre,
        producto.precio_cents,
        producto.is_variable,
        producto.orden_prioridad,
        producto.activo,
        now,
        producto.id
      ]
    );
  } catch (error) {
    console.error('[DB Query] Error al actualizar producto:', error);
    throw error;
  }
}

/**
 * Intercambia el orden_prioridad de dos productos en una sola transacción.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de expo-sqlite
 * @param {Object} params
 * @param {string} params.idA UUID del producto A
 * @param {number} params.ordenA Nuevo orden del producto A (será el antiguo de B)
 * @param {string} params.idB UUID del producto B
 * @param {number} params.ordenB Nuevo orden del producto B (será el antiguo de A)
 * @returns {Promise<void>}
 */
export async function intercambiarOrden(db, { idA, ordenA, idB, ordenB }) {
  try {
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE productos SET orden_prioridad = ?, is_synced = 0, updated_at = ? WHERE id = ?;`,
        [ordenA, now, idA]
      );
      await db.runAsync(
        `UPDATE productos SET orden_prioridad = ?, is_synced = 0, updated_at = ? WHERE id = ?;`,
        [ordenB, now, idB]
      );
    });
  } catch (error) {
    console.error('[DB Query] Error al intercambiar orden de productos:', error);
    throw error;
  }
}
