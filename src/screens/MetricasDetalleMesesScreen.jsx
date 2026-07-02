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
import { getVentasPorMesDelAnio } from '../database/queries/reportes';
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

function getNombreMes(mesStr) {
  try {
    const [, month] = mesStr.split('-').map(Number);
    return MESES[month - 1];
  } catch {
    return mesStr;
  }
}

export default function MetricasDetalleMesesScreen() {
  const { db } = useDb();
  const navigation = useNavigation();

  const hoy = new Date();
  const [anioSeleccionado, setAnioSeleccionado] = useState(hoy.getFullYear());
  const [showYearModal, setShowYearModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState([]);

  const aniosDisponibles = useMemo(() => {
    const list = [];
    for (let a = hoy.getFullYear(); a >= 2024; a--) {
      list.push(a);
    }
    return list;
  }, []);

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const data = await getVentasPorMesDelAnio(db, anioSeleccionado);
      setVentas(data);
    } catch (err) {
      console.error('[DetalleMeses] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [anioSeleccionado, db]);

  // Configurar header con selector de año
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setShowYearModal(true)}
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
            {anioSeleccionado}
          </CustomText>
          <CustomText style={{ color: '#9ca3af', fontSize: 10 }}>▼</CustomText>
        </TouchableOpacity>
      ),
    });
  }, [navigation, anioSeleccionado]);

  // Construir lista completa de 12 meses con datos
  const mesesCompletos = useMemo(() => {
    const ventasMap = {};
    for (const v of ventas) {
      ventasMap[v.mes] = v;
    }
    const result = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${anioSeleccionado}-${String(m).padStart(2, '0')}`;
      result.push({
        mes: key,
        total_cents: ventasMap[key]?.total_cents ?? 0,
        pedidos: ventasMap[key]?.pedidos ?? 0,
      });
    }
    return result;
  }, [ventas, anioSeleccionado]);

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
      {/* Modal selector de año */}
      <Modal
        visible={showYearModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowYearModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <CustomText style={styles.modalTitle}>Seleccionar Año</CustomText>
            {aniosDisponibles.map((a) => {
              const esSeleccionado = a === anioSeleccionado;
              return (
                <TouchableOpacity
                  key={a}
                  style={[styles.modalOption, esSeleccionado && styles.modalOptionSelected]}
                  onPress={() => {
                    setAnioSeleccionado(a);
                    setShowYearModal(false);
                  }}
                >
                  <CustomText
                    style={[
                      styles.modalOptionText,
                      esSeleccionado && styles.modalOptionTextSelected,
                    ]}
                  >
                    {a}
                  </CustomText>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowYearModal(false)}
            >
              <CustomText style={styles.modalCloseButtonText}>Cancelar</CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        data={mesesCompletos}
        keyExtractor={(item) => item.mes}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => {
          const tieneVentas = item.total_cents > 0;
          return (
            <View style={[styles.row, !tieneVentas && styles.rowEmpty]}>
              <CustomText style={[styles.mesLabel, !tieneVentas && styles.mesLabelEmpty]}>
                {getNombreMes(item.mes)}
              </CustomText>
              {tieneVentas ? (
                <>
                  <CustomText style={styles.mesAmount}>
                    S/ {(item.total_cents / 100).toFixed(2)}
                  </CustomText>
                  <CustomText style={styles.mesPedidos}>
                    {item.pedidos} pedido{item.pedidos !== 1 ? 's' : ''}
                  </CustomText>
                </>
              ) : (
                <CustomText style={styles.sinVentas}>Sin ventas</CustomText>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          totalCents > 0 ? (
            <View style={styles.totalRow}>
              <CustomText style={styles.totalLabel}>Total del año:</CustomText>
              <CustomText style={styles.totalAmount}>S/ {(totalCents / 100).toFixed(2)}</CustomText>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <CustomText style={styles.emptyText}>
                No hay ventas registradas en {anioSeleccionado}.
              </CustomText>
            </View>
          )
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
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  rowEmpty: {
    backgroundColor: '#f9fafb',
    borderColor: '#f3f4f6',
  },
  mesLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textoPrimario,
  },
  mesLabelEmpty: {
    color: '#d1d5db',
    fontStyle: 'italic',
  },
  mesAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textoPrimario,
    marginRight: 12,
  },
  mesPedidos: {
    fontSize: 12,
    color: COLORS.textoSecundario,
    width: 80,
    textAlign: 'right',
  },
  sinVentas: {
    fontSize: 13,
    color: '#d1d5db',
    fontStyle: 'italic',
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
