import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDetalleVenta } from '../database/queries/ventas';
import { normalizarExpresion } from '../utils/expresiones';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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
    const months = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  } catch (e) {
    return dateString;
  }
}

/**
 * Convierte una URI de archivo local a Base64.
 */
async function getLocalFileBase64(fileUri) {
  if (!fileUri) return '';
  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (e) {
    console.error('[PDF Service] Error al cargar archivo local en Base64:', e);
    return '';
  }
}

/**
 * Intercepta y valida los medios de pago antes de generar el PDF de liquidación.
 */
export async function generarPDFLiquidacion(db, { aula, turno, mes, navigation }) {
  try {
    // 1. Consultar medios de pago
    const medios = await db.getAllAsync('SELECT * FROM medios_pago ORDER BY id ASC;');

    // 2. Consultar AsyncStorage
    const omitirAdvertencia = await AsyncStorage.getItem('@config_omitir_advertencia_qr');

    if (medios.length === 0 && omitirAdvertencia !== 'true') {
      // Detener y disparar alerta
      Alert.alert(
        'Sin medios de pago',
        '¿Seguro que desea generar la boleta de pago sin medios de pago?',
        [
          {
            text: 'Agregar ahora',
            onPress: () => {
              if (navigation) {
                navigation.navigate('ConfigTab', { screen: 'MediosPago' });
              }
            },
          },
          {
            text: 'Sí',
            onPress: () => {
              ejecutarGeneracionPDF(db, { aula, turno, mes, medios: [] });
            },
          },
          {
            text: 'Sí y no volver a preguntar',
            onPress: async () => {
              await AsyncStorage.setItem('@config_omitir_advertencia_qr', 'true');
              ejecutarGeneracionPDF(db, { aula, turno, mes, medios: [] });
            },
          },
        ],
      );
      return;
    }

    // Continuar directamente
    await ejecutarGeneracionPDF(db, { aula, turno, mes, medios });
  } catch (error) {
    console.error('[PDF Service] Error en interceptor de PDF:', error);
    Alert.alert('Error', 'Ocurrió un error al procesar el documento.');
  }
}

/**
 * Ejecuta la generación física del PDF y abre el Share Sheet.
 */
async function ejecutarGeneracionPDF(db, { aula, turno, mes, medios }) {
  // Verificar disponibilidad de compartir
  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    Alert.alert('Error', 'El servicio de compartir no está disponible en este dispositivo.');
    return;
  }

  // 1. Obtener todas las ventas activas (no anuladas) del aula en el mes especificado
  const ventas = await db.getAllAsync(
    `SELECT * FROM ventas
     WHERE aula = ? AND strftime('%Y-%m', fecha_venta) = ? AND anulado_at IS NULL
     ORDER BY fecha_venta ASC, fecha_registro ASC;`,
    [aula, mes],
  );

  if (ventas.length === 0) {
    Alert.alert(
      'Sin datos',
      'No existen consumos registrados para generar el reporte de este período.',
    );
    return;
  }

  // 2. Agrupar consumos por fecha
  const ventasPorFecha = {};
  let totalCents = 0;
  let pendienteCents = 0;

  for (const sale of ventas) {
    totalCents += sale.total_cents;
    if (sale.estado_pago === 0) {
      pendienteCents += sale.total_cents;
    }

    const detalles = await getDetalleVenta(db, sale.id);
    const readableDate = formatReadableDate(sale.fecha_venta);

    if (!ventasPorFecha[readableDate]) {
      ventasPorFecha[readableDate] = [];
    }
    ventasPorFecha[readableDate].push(...detalles);
  }

  // 3. Armar filas HTML agrupadas por fecha y fusionando mismo producto
  let filasHTML = '';
  const fechasOrdenadas = Object.keys(ventasPorFecha);

  for (const fecha of fechasOrdenadas) {
    const detalles = ventasPorFecha[fecha];

    // Agrupar detalles por producto_id para fusionar mismo producto
    const grupos = {};
    for (const det of detalles) {
      const key = det.producto_id || det.producto_nombre;
      if (!grupos[key]) {
        grupos[key] = { ...det };
        // Normalizar también el primer elemento para que, si tiene
        // detalle_multiplicador NULL, se use la cantidad como expresión base
        const expInicial = grupos[key].detalle_multiplicador || `${grupos[key].cantidad}`;
        grupos[key].detalle_multiplicador = normalizarExpresion(expInicial);
      } else {
        // Fusionar: sumar cantidades y subtotales, concatenar expresiones
        grupos[key].cantidad += det.cantidad;
        grupos[key].subtotal_cents += det.subtotal_cents;
        // Concatenar y simplificar detalle_multiplicador
        // Si es NULL (registro antiguo), usar la cantidad como expresión base
        // Si mismo multiplicando se repite, se factoriza (ej: "30x3"+"30" → "30x4")
        const expActual = det.detalle_multiplicador || `${det.cantidad}`;
        if (grupos[key].detalle_multiplicador) {
          const combinada = grupos[key].detalle_multiplicador + '+' + expActual;
          grupos[key].detalle_multiplicador = normalizarExpresion(combinada);
        } else {
          grupos[key].detalle_multiplicador = normalizarExpresion(expActual);
        }
      }
    }

    const detallesAgrupados = Object.values(grupos);
    const rowspan = detallesAgrupados.length;

    for (let i = 0; i < detallesAgrupados.length; i++) {
      const det = detallesAgrupados[i];
      // Mostrar detalle entre paréntesis solo si la expresión no es un simple número
      // (evita mostrar "15 (15)" para registros antiguos sin detalle_multiplicador)
      const esExpresionCompuesta =
        det.detalle_multiplicador && /[x+]/.test(det.detalle_multiplicador);
      const cantidadTexto = esExpresionCompuesta
        ? `${det.cantidad} (${det.detalle_multiplicador})`
        : `${det.cantidad}`;

      filasHTML += `
        <tr>
      `;

      if (i === 0) {
        filasHTML += `
          <td rowspan="${rowspan}" style="vertical-align: middle; font-weight: bold; background-color: #fafafa; border-right: 1px solid #e5e7eb; text-align: center;">
            ${fecha}
          </td>
        `;
      }

      filasHTML += `
          <td>${det.producto_nombre}</td>
          <td>${cantidadTexto}</td>
          <td>S/ ${(det.subtotal_cents / 100).toFixed(2)}</td>
        </tr>
      `;
    }
  }

  const mesFormateado = formatMes(mes);
  const fechaEmision = formatLongDate();
  const totalFormateado = (totalCents / 100).toFixed(2);
  const montoPendienteFormateado = (pendienteCents / 100).toFixed(2);

  // 4. Inclusión dinámica de QRs de pago
  let qrHTML = '';
  if (medios && medios.length > 0) {
    qrHTML += `
      <div class="qr-section" style="margin-top: 25px;">
        <h2 style="font-size: 14px; margin-bottom: 12px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Medios de Pago</h2>
        <div class="qr-container" style="width: 100%; text-align: left;">
    `;

    for (const medio of medios) {
      const base64Img = await getLocalFileBase64(medio.qr_image_path);
      if (base64Img) {
        qrHTML += `
          <div class="qr-card" style="display: inline-block; width: 30%; max-width: 160px; min-width: 130px; margin-right: 18px; margin-bottom: 18px; vertical-align: top; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; text-align: center; background-color: #ffffff;">
            
            <div style="margin-bottom: 8px;">
              <img src="${base64Img}" style="width: 110px; height: 110px; object-fit: contain; border-radius: 4px; display: inline-block;" />
            </div>
            
            <div style="text-align: center;">
              <strong style="font-size: 12px; color: #111827; display: block; margin-bottom: 3px; word-wrap: break-word;">${medio.banco_nombre}</strong>
              <span style="font-size: 10px; color: #4b5563; line-height: 1.3; display: block; word-wrap: break-word;">${medio.descripcion || ''}</span>
            </div>
            
          </div>
        `;
      }
    }

    qrHTML += `
          <div style="clear: both;"></div>
        </div>
      </div>
    `;
  }

  // 5. Armar el HTML definitivo del PDF con tamaño A4 explícito
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @page {
        size: A4;
        margin: 10mm;
      }
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 5px; color: #111827; }
      h1 { font-size: 18px; color: #111827; margin-bottom: 4px; }
      h2 { font-size: 13px; color: #374151; margin-top: 20px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background-color: #f3f4f6; padding: 8px; text-align: left; font-size: 11px; color: #374151; font-weight: bold; }
      td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
      .total-row td { font-weight: bold; font-size: 12px; border-top: 2px solid #9ca3af; border-bottom: 2px solid #9ca3af; background-color: #f9fafb; }
      .monto-grande { font-size: 20px; font-weight: bold; color: #dc2626; }
      .footer { margin-top: 36px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 12px; }
      .qr-section { margin-top: 24px; page-break-inside: avoid; }
      .qr-section table { width: auto; }
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
          <th style="width: 100px; text-align: center;">Fecha</th>
          <th>Descripción</th>
          <th style="width: 120px;">Cant.</th>
          <th style="width: 120px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${filasHTML}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3" style="text-align: right; padding-right: 16px;">TOTAL DEL MES</td>
          <td>S/ ${totalFormateado}</td>
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
 
    <!-- QR DE PAGO DINÁMICO -->
    ${qrHTML}
 
    <!-- FOOTER -->
    <div class="footer">
      Documento generado automáticamente por el Sistema de Control de Copias de CopyCenter Flor
    </div>
  </body>
  </html>
  `;

  // 6. Generar y abrir Share Sheet
  try {
    const safeAulaName = aula.replace(/[\s°]/g, '_');
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      width: 595, // A4 width in pixels at 72 DPI
      height: 842, // A4 height in pixels at 72 DPI
    });

    // Mover a un archivo con nombre más amigable
    const newUri = `${FileSystem.cacheDirectory}Liquidacion_${safeAulaName}_${mes}.pdf`;
    await FileSystem.moveAsync({
      from: uri,
      to: newUri,
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
