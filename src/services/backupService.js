import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';

/**
 * Genera una copia de seguridad en formato JSON de la base de datos local y la comparte.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de la BD
 * @returns {Promise<string>} Fecha formateada del backup "YYYY-MM-DD"
 */
export async function exportarBackup(db) {
  // Verificar disponibilidad de compartir
  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    Alert.alert('Error', 'El servicio de compartir no está disponible en este dispositivo.');
    throw new Error('Servicio de compartir no disponible.');
  }

  try {
    // 1. Obtener todos los datos de las 3 tablas principales
    const productos = await db.getAllAsync('SELECT * FROM productos;');
    const ventas = await db.getAllAsync('SELECT * FROM ventas;');
    const detalles = await db.getAllAsync('SELECT * FROM detalle_ventas;');

    // 2. Construir objeto de backup
    const backup = {
      version: '3.0',
      exported_at: new Date().toISOString(),
      exported_by: 'app-copias-v1',
      data: {
        productos,
        ventas,
        detalle_ventas: detalles,
      },
      stats: {
        total_productos: productos.length,
        total_ventas: ventas.length,
        total_detalles: detalles.length,
      },
    };

    // 3. Serializar y escribir a FileSystem local temporal
    const json = JSON.stringify(backup, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `respaldo_copias_${dateStr}.json`;
    const uri = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(uri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // 4. Compartir archivo usando Share Sheet nativo
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Guardar respaldo de la app',
    });

    // 5. Actualizar app_config con la fecha del último backup
    const now = new Date().toISOString();
    await db.runAsync("UPDATE app_config SET value = ? WHERE key = 'ultimo_backup';", [now]);

    return dateStr;
  } catch (error) {
    console.error('[Backup Service] Error al exportar backup:', error);
    throw error;
  }
}

/**
 * Permite seleccionar un archivo JSON e importa/restaura los datos en la base local.
 * Utiliza transacciones y optimización para insertar miles de registros de forma segura.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @returns {Promise<{productos: number, ventas: number, detalles: number} | null>} Stats de importación
 */
export async function importarBackup(db) {
  try {
    // 1. Seleccionar el archivo JSON
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (res.canceled || !res.assets || res.assets.length === 0) {
      console.log('[Backup Service] Selección de archivo cancelada.');
      return null;
    }

    const fileUri = res.assets[0].uri;

    // 2. Leer archivo de forma asíncrona
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // 3. Parsear y validar
    const backup = JSON.parse(fileContent);

    if (
      !backup.data ||
      !backup.data.productos ||
      !backup.data.ventas ||
      !backup.data.detalle_ventas
    ) {
      throw new Error('Estructura de archivo de respaldo no válida. Faltan tablas obligatorias.');
    }

    const { productos, ventas, detalle_ventas } = backup.data;

    // 4. Confirmación del usuario
    return new Promise((resolve, reject) => {
      Alert.alert(
        'Confirmar Restauración',
        `¿Está seguro de restaurar desde este archivo?\n\n` +
          `• Productos en archivo: ${productos.length}\n` +
          `• Ventas en archivo: ${ventas.length}\n` +
          `• Detalles en archivo: ${detalle_ventas.length}\n\n` +
          `Se sobrescribirán o añadirán los registros en la base de datos local. Esta acción no se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: async () => {
              try {
                // Ejecutar en una sola transacción masiva
                await db.execAsync('BEGIN TRANSACTION;');

                // A. Productos
                for (const p of productos) {
                  await db.runAsync(
                    `INSERT OR REPLACE INTO productos (id, nombre, precio_cents, is_variable, is_custom, orden_prioridad, activo, is_synced, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                    [
                      p.id,
                      p.nombre,
                      p.precio_cents,
                      p.is_variable ?? 0,
                      p.is_custom ?? 0,
                      p.orden_prioridad ?? 0,
                      p.activo ?? 1,
                      p.is_synced ?? 0,
                      p.updated_at ?? new Date().toISOString(),
                    ],
                  );
                }

                // B. Ventas
                for (const v of ventas) {
                  await db.runAsync(
                    `INSERT OR REPLACE INTO ventas (id, fecha_venta, fecha_registro, turno, aula, total_cents, estado_pago, anulado_at, motivo_anulacion, is_synced, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                    [
                      v.id,
                      v.fecha_venta,
                      v.fecha_registro,
                      v.turno,
                      v.aula,
                      v.total_cents,
                      v.estado_pago ?? 0,
                      v.anulado_at ?? null,
                      v.motivo_anulacion ?? null,
                      v.is_synced ?? 0,
                      v.updated_at ?? new Date().toISOString(),
                    ],
                  );
                }

                // C. Detalle Ventas
                for (const d of detalle_ventas) {
                  await db.runAsync(
                    `INSERT OR REPLACE INTO detalle_ventas (id, venta_id, producto_id, producto_nombre, cantidad, precio_unitario_cents, subtotal_cents, detalle_multiplicador)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
                    [
                      d.id,
                      d.venta_id,
                      d.producto_id ?? null,
                      d.producto_nombre,
                      d.cantidad,
                      d.precio_unitario_cents,
                      d.subtotal_cents,
                      d.detalle_multiplicador ?? null,
                    ],
                  );
                }

                await db.execAsync('COMMIT;');

                // Guardar la fecha de última restauración en la configuración local
                const nowStr = new Date().toLocaleString();
                await db.runAsync("UPDATE app_config SET value = ? WHERE key = 'ultimo_backup';", [
                  nowStr,
                ]);

                resolve({
                  productos: productos.length,
                  ventas: ventas.length,
                  detalles: detalle_ventas.length,
                  fecha: nowStr,
                });
              } catch (err) {
                try {
                  await db.execAsync('ROLLBACK;');
                } catch (_) {}
                reject(err);
              }
            },
          },
        ],
      );
    });
  } catch (error) {
    console.error('[Backup Service] Error al importar backup:', error);
    throw error;
  }
}
