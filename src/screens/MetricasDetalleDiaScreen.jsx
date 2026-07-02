import CustomText from '../components/CustomText';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { getVentasDelDiaAgrupadas } from '../database/queries/reportes';
import COLORS from '../constants/colors';

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

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function formatearFechaLarga(fechaStr) {
  try {
    const d = new Date(fechaStr + 'T12:00:00');
    return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  } catch {
    return fechaStr;
  }
}

export default function MetricasDetalleDiaScreen() {
  const { db } = useDb();
  const navigation = useNavigation();
  const route = useRoute();
  const { fecha } = route.params;

  const mes = fecha.slice(0, 7);

  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState([]);

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const data = await getVentasDelDiaAgrupadas(db, fecha);
      setVentas(data);
    } catch (err) {
      console.error('[DetalleDia] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fecha, db]);

  const totalCents = ventas.reduce((sum, v) => sum + v.total_cents, 0);
  const pendienteCents = ventas
    .filter((v) => v.estado_pago === 0)
    .reduce((sum, v) => sum + v.total_cents, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* Encabezado del día */}
      <View style={styles.header}>
        <CustomText style={styles.headerTitle}>{formatearFechaLarga(fecha)}</CustomText>
        <CustomText style={styles.headerSubtitle}>
          {ventas.length} venta{ventas.length !== 1 ? 's' : ''} · S/ {(totalCents / 100).toFixed(2)}
        </CustomText>
      </View>

      <FlatList
        data={ventas}
        keyExtractor={(item) => item.venta_id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.ventaCard}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate('AulaDetail', {
                aula: item.aula,
                turno: item.turno,
                mes,
              })
            }
          >
            <View style={styles.ventaHeader}>
              <View style={styles.aulaInfo}>
                <CustomText style={styles.aulaName}>{item.aula}</CustomText>
                <CustomText style={styles.aulaTurno}>Turno {item.turno}</CustomText>
              </View>
              <View
                style={[
                  styles.badge,
                  item.estado_pago === 1 ? styles.badgePaid : styles.badgeUnpaid,
                ]}
              >
                <CustomText
                  style={item.estado_pago === 1 ? styles.badgeTextPaid : styles.badgeTextUnpaid}
                >
                  {item.estado_pago === 1 ? 'Pagado' : 'Pendiente'}
                </CustomText>
              </View>
            </View>

            {item.productos && (
              <CustomText style={styles.productos} numberOfLines={3}>
                {item.productos}
              </CustomText>
            )}

            <CustomText style={styles.total}>S/ {(item.total_cents / 100).toFixed(2)}</CustomText>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CustomText style={styles.emptyText}>No hay ventas registradas este día.</CustomText>
          </View>
        }
        ListFooterComponent={
          ventas.length > 0 ? (
            <View style={styles.footer}>
              {/* Resumen */}
              <View style={styles.resumenCard}>
                <View style={styles.resumenRow}>
                  <CustomText style={styles.resumenLabel}>Total ventas</CustomText>
                  <CustomText style={styles.resumenValue}>
                    S/ {(totalCents / 100).toFixed(2)}
                  </CustomText>
                </View>
                <View style={styles.resumenRow}>
                  <CustomText style={styles.resumenLabel}>Por cobrar</CustomText>
                  <CustomText style={[styles.resumenValue, styles.resumenPendiente]}>
                    S/ {(pendienteCents / 100).toFixed(2)}
                  </CustomText>
                </View>
                <View style={styles.resumenRow}>
                  <CustomText style={styles.resumenLabel}>Cobrado</CustomText>
                  <CustomText style={[styles.resumenValue, styles.resumenPagado]}>
                    S/ {((totalCents - pendienteCents) / 100).toFixed(2)}
                  </CustomText>
                </View>
              </View>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.fondoPantalla,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borde,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textoSecundario,
    marginTop: 4,
  },
  listContainer: {
    padding: 12,
    paddingBottom: 40,
  },
  ventaCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  ventaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  aulaInfo: {
    flex: 1,
  },
  aulaName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
  },
  aulaTurno: {
    fontSize: 12,
    color: COLORS.textoSecundario,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePaid: {
    backgroundColor: '#d1fae5',
  },
  badgeUnpaid: {
    backgroundColor: '#fee2e2',
  },
  badgeTextPaid: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#059669',
  },
  badgeTextUnpaid: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  productos: {
    fontSize: 13,
    color: COLORS.textoSecundario,
    marginVertical: 4,
    lineHeight: 18,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textoPrimario,
    marginTop: 4,
  },
  footer: {
    marginTop: 12,
  },
  resumenCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  resumenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  resumenLabel: {
    fontSize: 14,
    color: COLORS.textoSecundario,
    fontWeight: '500',
  },
  resumenValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textoPrimario,
  },
  resumenPendiente: {
    color: '#dc2626',
  },
  resumenPagado: {
    color: '#059669',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textoSecundario,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
