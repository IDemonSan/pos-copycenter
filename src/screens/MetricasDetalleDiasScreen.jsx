import CustomText from '../components/CustomText';
import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { getVentasPorDiaDelMes } from '../database/queries/reportes';
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

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatearFechaCorta(diaStr) {
  try {
    const d = new Date(diaStr + 'T12:00:00');
    return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
  } catch {
    return diaStr;
  }
}

function getNombreMes(mesString) {
  const [year, month] = mesString.split('-');
  return `${MESES[parseInt(month, 10) - 1]} ${year}`;
}

export default function MetricasDetalleDiasScreen() {
  const { db } = useDb();
  const navigation = useNavigation();

  const hoy = new Date();
  const [mesSeleccionado, setMesSeleccionado] = useState(
    `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`,
  );
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState([]);

  const ultimosMeses = useMemo(() => {
    const list = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
  }, []);

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const data = await getVentasPorDiaDelMes(db, mesSeleccionado);
      setVentas(data);
    } catch (err) {
      console.error('[DetalleDias] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mesSeleccionado, db]);

  // Configurar header con selector de mes
  const nombreMes = getNombreMes(mesSeleccionado);
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setShowMonthModal(true)}
          style={{
            marginRight: 16,
            backgroundColor: '#374151',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <CustomText style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', marginRight: 4 }}>
            {nombreMes}
          </CustomText>
          <CustomText style={{ color: '#9ca3af', fontSize: 10 }}>▼</CustomText>
        </TouchableOpacity>
      ),
    });
  }, [navigation, nombreMes]);

  const totalCents = ventas.reduce((sum, v) => sum + v.total_cents, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* Modal selector de mes */}
      <Modal
        visible={showMonthModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <CustomText style={styles.modalTitle}>Seleccionar Mes</CustomText>
            {ultimosMeses.map((m) => {
              const esSeleccionado = m === mesSeleccionado;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.modalOption, esSeleccionado && styles.modalOptionSelected]}
                  onPress={() => {
                    setMesSeleccionado(m);
                    setShowMonthModal(false);
                  }}
                >
                  <CustomText
                    style={[
                      styles.modalOptionText,
                      esSeleccionado && styles.modalOptionTextSelected,
                    ]}
                  >
                    {getNombreMes(m)}
                  </CustomText>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowMonthModal(false)}
            >
              <CustomText style={styles.modalCloseButtonText}>Cancelar</CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        data={ventas}
        keyExtractor={(item) => item.dia}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MetricasDetalleDia', { fecha: item.dia })}
          >
            <CustomText style={styles.diaLabel}>{formatearFechaCorta(item.dia)}</CustomText>
            <CustomText style={styles.diaAmount}>
              S/ {(item.total_cents / 100).toFixed(2)}
            </CustomText>
            <CustomText style={styles.diaPedidos}>
              {item.pedidos} pedido{item.pedidos !== 1 ? 's' : ''}
            </CustomText>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CustomText style={styles.emptyText}>
              No hay ventas registradas en {getNombreMes(mesSeleccionado)}.
            </CustomText>
          </View>
        }
        ListFooterComponent={
          ventas.length > 0 ? (
            <View style={styles.totalRow}>
              <CustomText style={styles.totalLabel}>Total del mes:</CustomText>
              <CustomText style={styles.totalAmount}>S/ {(totalCents / 100).toFixed(2)}</CustomText>
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
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  diaLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textoPrimario,
  },
  diaAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textoPrimario,
    marginRight: 12,
  },
  diaPedidos: {
    fontSize: 12,
    color: COLORS.textoSecundario,
    width: 80,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textoPrimario,
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
    marginBottom: 16,
  },
  modalOption: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 4,
    backgroundColor: '#f3f4f6',
  },
  modalOptionSelected: {
    backgroundColor: '#3b82f6',
  },
  modalOptionText: {
    fontSize: 15,
    color: COLORS.textoPrimario,
    fontWeight: '500',
  },
  modalOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  modalCloseButtonText: {
    fontSize: 15,
    color: COLORS.textoSecundario,
    fontWeight: '600',
  },
});
