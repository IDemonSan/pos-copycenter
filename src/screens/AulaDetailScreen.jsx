import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { anularVenta, marcarComoPagado } from '../database/queries/ventas';
import { generarPDFLiquidacion } from '../services/pdfService';
import COLORS from '../constants/colors';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

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

export default function AulaDetailScreen() {
  const { db } = useDb();
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();

  const { aula, turno, mes } = route.params;

  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState([]);
  const [deudaTotalCents, setDeudaTotalCents] = useState(0);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const handleGenerarPDF = async () => {
    setGenerandoPDF(true);
    try {
      await generarPDFLiquidacion(db, { aula, turno, mes });
    } catch (error) {
      console.error('[AulaDetail] Error al generar PDF:', error);
      Alert.alert('Error', 'No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setGenerandoPDF(false);
    }
  };

  const formatMesTitle = () => {
    try {
      const [year, month] = mes.split('-');
      const mesNombre = MESES[parseInt(month, 10) - 1];
      return `${mesNombre} ${year}`;
    } catch (e) {
      return mes;
    }
  };

  const loadVentas = async () => {
    if (!db) return;
    setLoading(true);
    try {
      // 1. Obtener ventas activas del aula-turno del mes
      const sales = await db.getAllAsync(
        `SELECT * FROM ventas
         WHERE aula = ? AND turno = ? AND strftime('%Y-%m', fecha_venta) = ? AND anulado_at IS NULL
         ORDER BY fecha_venta DESC, fecha_registro DESC;`,
        [aula, turno, mes]
      );

      // 2. Obtener detalles para cada venta
      const salesWithDetails = [];
      let totalDeuda = 0;

      for (const sale of sales) {
        const details = await db.getAllAsync(
          `SELECT * FROM detalle_ventas WHERE venta_id = ?;`,
          [sale.id]
        );
        salesWithDetails.push({ ...sale, detalles: details });

        if (sale.estado_pago === 0) {
          totalDeuda += sale.total_cents;
        }
      }

      setVentas(salesWithDetails);
      setDeudaTotalCents(totalDeuda);
    } catch (err) {
      console.error('[AulaDetail] Error al cargar ventas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadVentas();
    }
  }, [isFocused, db]);

  const handleMarcarTodoPagado = () => {
    const unpaidVentas = ventas.filter((v) => v.estado_pago === 0);
    if (unpaidVentas.length === 0) return;

    const totalSoles = (deudaTotalCents / 100).toFixed(2);

    Alert.alert(
      'Marcar todo como pagado',
      `¿Confirmar que ${aula} liquidó toda la deuda de S/ ${totalSoles}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar pago',
          onPress: async () => {
            try {
              const ventaIds = unpaidVentas.map((v) => v.id);
              await marcarComoPagado(db, { ventaIds });
              loadVentas();
            } catch (err) {
              console.error('[AulaDetail] Error al pagar todo:', err);
              Alert.alert('Error', 'No se pudo liquidar la deuda.');
            }
          },
        },
      ]
    );
  };

  const handleVentaLongPress = (venta) => {
    const fechaText = formatReadableDate(venta.fecha_venta);
    const montoText = `S/ ${(venta.total_cents / 100).toFixed(2)}`;

    Alert.alert(
      'Opciones',
      `Venta del ${fechaText} — ${montoText}`,
      [
        {
          text: 'Anular esta venta',
          style: 'destructive',
          onPress: () => mostrarModalAnulacion(venta),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const mostrarModalAnulacion = (venta) => {
    Alert.alert(
      '¿Por qué se anula?',
      'Selecciona el motivo de la anulación:',
      [
        { text: 'Error en cantidad', onPress: () => ejecutarAnulacion(venta, 'Error en cantidad') },
        { text: 'Pedido cancelado', onPress: () => ejecutarAnulacion(venta, 'Pedido cancelado') },
        { text: 'Duplicado', onPress: () => ejecutarAnulacion(venta, 'Duplicado') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const ejecutarAnulacion = async (venta, motivo) => {
    try {
      await anularVenta(db, { id: venta.id, motivo });
      
      // Recargar datos
      await loadVentas();

      // Consultar si desea corregir
      Alert.alert(
        'Venta anulada',
        '¿Deseas registrar una venta corregida ahora?',
        [
          { text: 'No, gracias', style: 'cancel' },
          {
            text: 'Sí, corregir',
            onPress: () => {
              navigation.navigate('POS', {
                aulaPreseleccionada: aula,
                fechaPreseleccionada: venta.fecha_venta,
              });
            },
          },
        ]
      );
    } catch (err) {
      console.error('[AulaDetail] Error al anular venta:', err);
      Alert.alert('Error', 'No se pudo anular la venta.');
    }
  };

  const renderVentaItem = ({ item }) => {
    const totalSoles = (item.total_cents / 100).toFixed(2);
    const isBatchEntry = item.fecha_venta !== item.fecha_registro.slice(0, 10);
    
    // Detalle descriptivo de productos
    const productStr = item.detalles
      ? item.detalles.map((d) => `${d.cantidad}x ${d.producto_nombre}`).join(', ')
      : '';

    return (
      <TouchableOpacity
        style={styles.ventaCard}
        activeOpacity={0.7}
        onLongPress={() => handleVentaLongPress(item)}
      >
        <View style={styles.ventaHeader}>
          <Text style={styles.ventaDate}>{formatReadableDate(item.fecha_venta)}</Text>
          <View style={styles.badges}>
            {isBatchEntry && (
              <View style={[styles.badge, styles.badgeBatch]}>
                <Text style={styles.badgeTextBatch}>Transcrito</Text>
              </View>
            )}
            <View
              style={[
                styles.badge,
                item.estado_pago === 1 ? styles.badgePaid : styles.badgeUnpaid,
              ]}
            >
              <Text
                style={
                  item.estado_pago === 1 ? styles.badgeTextPaid : styles.badgeTextUnpaid
                }
              >
                {item.estado_pago === 1 ? 'Pagado' : 'Pendiente'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.ventaProducts} numberOfLines={2}>
          {productStr || 'Sin productos'}
        </Text>

        <Text style={styles.ventaTotal}>Total: S/ {totalSoles}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const deudasPendientes = ventas.some((v) => v.estado_pago === 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header info */}
        <View style={styles.infoBlock}>
          <Text style={styles.titleText}>{aula} — Turno {turno}</Text>
          <Text style={styles.subtitleText}>
            {formatMesTitle()} — Deuda: <Text style={styles.deudaRed}>S/ {(deudaTotalCents / 100).toFixed(2)}</Text>
          </Text>
        </View>

        {ventas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay ventas registradas para este salón en este mes.</Text>
          </View>
        ) : (
          <FlatList
            data={ventas}
            keyExtractor={(item) => item.id}
            renderItem={renderVentaItem}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Botón Generar PDF */}
        <TouchableOpacity
          style={styles.pdfButton}
          activeOpacity={0.7}
          onPress={handleGenerarPDF}
          disabled={generandoPDF}
        >
          {generandoPDF ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.pdfButtonText}>Generar PDF del mes</Text>
          )}
        </TouchableOpacity>

        {/* FAB: Marcar todo como pagado */}
        {deudasPendientes && (
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.8}
            onPress={handleMarcarTodoPagado}
          >
            <Text style={styles.fabText}>✓ Pagar todo</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.fondoPantalla,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBlock: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borde,
  },
  titleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
  },
  subtitleText: {
    fontSize: 14,
    color: COLORS.textoSecundario,
    marginTop: 4,
  },
  deudaRed: {
    fontWeight: 'bold',
    color: COLORS.deudaRojo,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textoSecundario,
    textAlign: 'center',
  },
  listContent: {
    padding: 12,
    paddingBottom: 80, // espacio para el botón de abajo
  },
  ventaCard: {
    backgroundColor: COLORS.fondoTarjeta,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  ventaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ventaDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 6,
  },
  badgePaid: {
    backgroundColor: COLORS.pagadoVerdeFondo,
  },
  badgeUnpaid: {
    backgroundColor: COLORS.deudaRojoFondo,
  },
  badgeBatch: {
    backgroundColor: COLORS.batchNaranjaFondo,
  },
  badgeTextPaid: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.pagadoVerde,
  },
  badgeTextUnpaid: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.deudaRojo,
  },
  badgeTextBatch: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.batchNaranja,
  },
  ventaProducts: {
    fontSize: 13,
    color: COLORS.textoSecundario,
    marginVertical: 4,
  },
  ventaTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textoPrimario,
    marginTop: 2,
  },
  pdfButton: {
    height: 50,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    borderRadius: 8,
  },
  pdfButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    backgroundColor: COLORS.pagadoVerde,
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  fabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
