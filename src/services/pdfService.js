import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { getDetalleVenta } from '../database/queries/ventas';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

function formatLongDate() {
  const date = new Date();
  const diaSemana = DIAS[date.getDay()];
  const dia = date.getDate();
  const mes = MESES[date.getMonth()];
  const anio = date.getFullYear();
  return `${diaSemana}, ${dia} de ${mes} de ${anio}`;
}

function formatMes(mesStr) {
  try {
    const [year, month] = mesStr.split('-');
    const name = MESES[parseInt(month, 10) - 1];
    return `${name} ${year}`;
  } catch (e) {
    return mesStr;
  }
}

function formatReadableDate(dateString) {
  try {
    const date = new Date(dateString + 'T12:00:00');
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  } catch (e) {
    return dateString;
  }
}

/**
 * Convierte un asset local de Expo a formato Base64.
 */
async function getQRBase64(assetModule) {
  try {
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${base64}`;
  } catch (e) {
    console.error('[PDF Service] Error al cargar QR en Base64:', e);
    // Retornar un pixel transparente en Base64 para evitar errores de renderizado en HTML
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }
}

/**
 * Genera el PDF de liquidación mensual y abre el Share Sheet.
 * @param {import('expo-sqlite').SQLiteDatabase} db Instancia de la BD
 * @param {Object} params
 * @param {string} params.aula Aula del reporte (ej: "3° A")
 * @param {string} params.turno Turno (ej: "Mañana")
 * @param {string} params.mes Período en formato "YYYY-MM"
 * @returns {Promise<void>}
 */
export async function generarPDFLiquidacion(db, { aula, turno, mes }) {
  // Verificar disponibilidad de compartir
  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    Alert.alert('Error', 'El servicio de compartir no está disponible en este dispositivo.');
    return;
  }

  // 1. Obtener todas las ventas activas (no anuladas) del aula-turno en el mes especificado
  const ventas = await db.getAllAsync(
    `SELECT * FROM ventas
     WHERE aula = ? AND turno = ? AND strftime('%Y-%m', fecha_venta) = ? AND anulado_at IS NULL
     ORDER BY fecha_venta ASC, fecha_registro ASC;`,
    [aula, turno, mes]
  );

  if (ventas.length === 0) {
    Alert.alert('Sin datos', 'No existen consumos registrados para generar el reporte de este período.');
    return;
  }

  // 2. Cargar QR base64
  // INSTRUCCIÓN PARA LA ENCARGADA:
  // Para usar tu QR real de Yape/Plin:
  // 1. Toma una foto de tu QR de Yape/Plin
  // 2. Renómbrala a "qr-yape.png" y "qr-plin.png"
  // 3. Reemplaza el archivo en la carpeta "assets/"
  const qrYapeBase64 = await getQRBase64(require('../../assets/qr-yape.png'));
  const qrPlinBase64 = await getQRBase64(require('../../assets/qr-plin.png'));

  // 3. Cargar detalles y armar filas HTML
  let totalCents = 0;
  let pendienteCents = 0;
  let filasHTML = '';

  for (const sale of ventas) {
    const detalles = await getDetalleVenta(db, sale.id);
    const rowSpan = detalles.length;
    const readableDate = formatReadableDate(sale.fecha_venta);
    
    const statusText = sale.estado_pago === 1 
      ? '<span class="pagado">Pagado</span>' 
      : '<span class="pendiente">Pendiente</span>';

    totalCents += sale.total_cents;
    if (sale.estado_pago === 0) {
      pendienteCents += sale.total_cents;
    }

    detalles.forEach((det, idx) => {
      filasHTML += '<tr>';
      
      // La celda de fecha tiene rowspan si hay múltiples líneas en la misma venta
      if (idx === 0) {
        filasHTML += `<td rowspan="${rowSpan}">${readableDate}</td>`;
      }

      filasHTML += `
        <td>${det.producto_nombre}</td>
        <td>${det.cantidad}</td>
        <td>S/ ${(det.precio_unitario_cents / 100).toFixed(2)}</td>
        <td>S/ ${(det.subtotal_cents / 100).toFixed(2)}</td>
      `;

      // La celda de estado también tiene rowspan
      if (idx === 0) {
        filasHTML += `<td rowspan="${rowSpan}">${statusText}</td>`;
      }

      filasHTML += '</tr>';
    });
  }

  const mesFormateado = formatMes(mes);
  const fechaEmision = formatLongDate();
  const totalFormateado = (totalCents / 100).toFixed(2);
  const montoPendienteFormateado = (pendienteCents / 100).toFixed(2);

  // 4. Armar el HTML definitivo del PDF (usando tablas clásicas, sin Flexbox/CSS Grid)
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111827; }
      h1 { font-size: 18px; color: #111827; margin-bottom: 4px; }
      h2 { font-size: 13px; color: #374151; margin-top: 20px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background-color: #f3f4f6; padding: 8px; text-align: left; font-size: 11px; color: #374151; font-weight: bold; }
      td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
      .total-row td { font-weight: bold; font-size: 12px; border-top: 2px solid #9ca3af; border-bottom: 2px solid #9ca3af; background-color: #f9fafb; }
      .monto-grande { font-size: 20px; font-weight: bold; color: #dc2626; }
      .pagado { color: #16a34a; font-weight: bold; }
      .pendiente { color: #dc2626; font-weight: bold; }
      .footer { margin-top: 36px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 12px; }
      .qr-section { margin-top: 24px; }
      .qr-section table { width: auto; }
      .qr-section td { text-align: center; padding: 8px 16px; border: none; }
      .qr-img { width: 110px; height: 110px; border: 1px solid #e5e7eb; border-radius: 4px; }
    </style>
  </head>
  <body>
    <!-- HEADER -->
    <h1>Centro de Copias — Liquidación Mensual</h1>
    <table style="border: none;">
      <tr style="border: none;">
        <td style="border: none; padding: 2px 0;"><strong>Aula:</strong> ${aula} — ${turno}</td>
        <td style="border: none; padding: 2px 0; text-align: right;"><strong>Período:</strong> ${mesFormateado}</td>
      </tr>
      <tr style="border: none;">
        <td style="border: none; padding: 2px 0;"><strong>Fecha de emisión:</strong> ${fechaEmision}</td>
        <td style="border: none; padding: 2px 0;"></td>
      </tr>
    </table>

    <!-- TABLA DE VENTAS -->
    <h2>Detalle de Consumo</h2>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Descripción</th>
          <th>Cant.</th>
          <th>P. Unit.</th>
          <th>Subtotal</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${filasHTML}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4">TOTAL DEL MES</td>
          <td>S/ ${totalFormateado}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <!-- MONTO A PAGAR -->
    <table style="border: none; margin-top: 16px;">
      <tr style="border: none;">
        <td style="border: none; font-size: 14px; font-weight: bold;">Monto pendiente de pago:</td>
        <td style="border: none; text-align: right;"><span class="monto-grande">S/ ${montoPendienteFormateado}</span></td>
      </tr>
    </table>

    <!-- QR DE PAGO -->
    <div class="qr-section">
      <h2>Medios de Pago</h2>
      <table>
        <tr>
          <td>
            <img src="${qrYapeBase64}" class="qr-img" /><br>
            <span style="font-size: 11px; font-weight: bold; margin-top: 4px; display: inline-block;">Yape</span>
          </td>
          <td>
            <img src="${qrPlinBase64}" class="qr-img" /><br>
            <span style="font-size: 11px; font-weight: bold; margin-top: 4px; display: inline-block;">Plin</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      Documento generado automáticamente por el Sistema de Control de Copias del Colegio
    </div>
  </body>
  </html>
  `;

  // 5. Generar y abrir Share Sheet
  try {
    const safeAulaName = aula.replace(/[\s°]/g, '_');
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    // Mover a un archivo con nombre más amigable
    const newUri = `${FileSystem.cacheDirectory}Liquidacion_${safeAulaName}_${mes}.pdf`;
    await FileSystem.moveAsync({
      from: uri,
      to: newUri
    });

    await Sharing.shareAsync(newUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Liquidación ${aula} — ${mesFormateado}`,
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('[PDF Service] Error al generar/compartir PDF:', error);
    throw error;
  }
}
