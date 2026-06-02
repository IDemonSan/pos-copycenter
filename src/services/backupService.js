import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
      }
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
    await db.runAsync(
      "UPDATE app_config SET value = ? WHERE key = 'ultimo_backup';",
      [now]
    );

    return dateStr;
  } catch (error) {
    console.error('[Backup Service] Error al exportar backup:', error);
    throw error;
  }
}
