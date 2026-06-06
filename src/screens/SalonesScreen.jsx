import CustomText from '../components/CustomText';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { getDeudaPorAula } from '../database/queries/reportes';
import { marcarComoPagado } from '../database/queries/ventas';
import AulaCard from '../components/AulaCard';
import SyncStatusIcon from '../components/SyncStatusIcon';
import COLORS from '../constants/colors';

const AULAS = [
  '1° A', '1° B', '1° C',
  '2° A', '2° B', '2° C',
  '3° A', '3° B', '3° C',
  '4° A', '4° B', '4° C',
  '5° A', '5° B', '5° C',
  '6° A', '6° B', '6° C',
];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function SalonesScreen() {
  const { db } = useDb();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [conDeuda, setConDeuda] = useState([]);
  const [alDia, setAlDia] = useState([]);
  const [alDiaExpanded, setAlDiaExpanded] = useState(false);

  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${año}-${mes}`;
  });
  const [showMonthModal, setShowMonthModal] = useState(false);

  const getNombreMes = (mesString) => {
    const [year, month] = mesString.split('-');
    const ind = parseInt(month, 10) - 1;
    return `${MESES[ind]} ${year}`;
  };

  const nombreMes = getNombreMes(mesSeleccionado);

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      // 1. Obtener aulas con deuda del mes seleccionado
      const dataDeudas = await getDeudaPorAula(db, mesSeleccionado);
      
      // Mapear deudas por aula para fácil acceso
      const deudasMap = new Map();
      dataDeudas.forEach(item => {
        deudasMap.set(item.aula, item);
      });

      // 2. Construir lista total de combinaciones
      const listConDeuda = [];
      const listAlDia = [];

      for (const aula of AULAS) {
        const derivedTurno = aula.endsWith('C') ? 'Tarde' : 'Mañana';
        if (deudasMap.has(aula)) {
          const item = deudasMap.get(aula);
          listConDeuda.push({
            aula,
            turno: item.turno ?? derivedTurno,
            deuda_cents: item.deuda_cents,
            num_pedidos: item.num_pedidos,
          });
        } else {
          listAlDia.push({
            aula,
            turno: derivedTurno,
            deuda_cents: 0,
            num_pedidos: 0,
          });
        }
      }

      setConDeuda(listConDeuda);
      setAlDia(listAlDia);
    } catch (err) {
      console.error('[Salones] Error al cargar deudas:', err);
    } finally {
      setLoading(false);
    }
  };

  const ultimosMeses = React.useMemo(() => {
    const list = [];
    const hoy = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const año = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      list.push(`${año}-${mes}`);
    }
    return list;
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
          <TouchableOpacity
            onPress={() => setShowMonthModal(true)}
            style={{
              marginRight: 8,
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
          <SyncStatusIcon />
        </View>
      )
    });
  }, [navigation, nombreMes]);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, db, mesSeleccionado]);

  const handleMarcarPagado = (aula, turno, deudaCents) => {
    const monto = (deudaCents / 100).toFixed(2);
    Alert.alert(
      'Marcar como pagado',
      `¿Confirmar que ${aula} (Turno: ${turno}) pagó S/ ${monto} de ${nombreMes}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar pago',
          onPress: async () => {
            try {
              // Obtener IDs de ventas pendientes específicas de esta aula y turno
              const sales = await db.getAllAsync(
                `SELECT id FROM ventas
                 WHERE aula = ?
                   AND turno = ?
                   AND strftime('%Y-%m', fecha_venta) = ?
                   AND estado_pago = 0
                   AND anulado_at IS NULL;`,
                [aula, turno, mesSeleccionado]
              );
              const ventaIds = sales.map(s => s.id);
              
              if (ventaIds.length > 0) {
                await marcarComoPagado(db, { ventaIds });
                loadData();
              }
            } catch (err) {
              console.error('[Salones] Error al marcar como pagado:', err);
              Alert.alert('Error', 'No se pudo registrar el pago.');
            }
          },
        },
      ]
    );
  };

  const handleVerDetalle = (aula, turno) => {
    navigation.navigate('AulaDetail', { aula, turno, mes: mesSeleccionado });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const totalAulasRegistradas = conDeuda.length;

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {/* Selector de Mes Modal */}
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
                    style={[
                      styles.modalOption,
                      esSeleccionado && styles.modalOptionSelected,
                    ]}
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

        {totalAulasRegistradas === 0 && alDia.length === 0 ? (
          <View style={styles.emptyContainer}>
            <CustomText style={styles.emptyText}>Aún no hay ventas este mes. Ve al POS para registrar.</CustomText>
          </View>
        ) : (
          <FlatList
            data={conDeuda}
            keyExtractor={(item) => item.aula}
            renderItem={({ item }) => (
              <AulaCard
                aula={item.aula}
                turno={item.turno}
                deuda_cents={item.deuda_cents}
                num_pedidos={item.num_pedidos}
                onVerDetalle={() => handleVerDetalle(item.aula, item.turno)}
                onMarcarPagado={() => handleMarcarPagado(item.aula, item.turno, item.deuda_cents)}
              />
            )}
            contentContainerStyle={styles.listContainer}
            ListHeaderComponent={
              <View style={styles.sectionHeader}>
                <CustomText style={styles.sectionTitle}>Aulas con Deuda ({conDeuda.length})</CustomText>
              </View>
            }
            ListFooterComponent={
              <View style={styles.footerSection}>
                <TouchableOpacity
                  style={styles.collapseHeader}
                  activeOpacity={0.7}
                  onPress={() => setAlDiaExpanded(!alDiaExpanded)}
                >
                  <CustomText style={styles.sectionTitle}>Al día ({alDia.length})</CustomText>
                  <CustomText style={styles.collapseIcon}>{alDiaExpanded ? '▲' : '▼'}</CustomText>
                </TouchableOpacity>

                {alDiaExpanded && (
                  <View style={styles.alDiaList}>
                    {alDia.map((item) => (
                      <AulaCard
                        key={item.aula}
                        aula={item.aula}
                        turno={item.turno}
                        deuda_cents={0}
                        num_pedidos={0}
                        onVerDetalle={() => handleVerDetalle(item.aula, item.turno)}
                        onMarcarPagado={() => {}}
                      />
                    ))}
                  </View>
                )}
              </View>
            }
          />
        )}
      </View>
    </View>
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: COLORS.textoSecundario,
  },
  listContainer: {
    padding: 12,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
  },
  footerSection: {
    marginTop: 16,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borde,
  },
  collapseIcon: {
    fontSize: 16,
    color: COLORS.textoSecundario,
  },
  alDiaList: {
    marginTop: 8,
  },
});
