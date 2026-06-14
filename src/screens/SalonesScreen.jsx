import CustomText from '../components/CustomText';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { getDeudaPorAula } from '../database/queries/reportes';
import { marcarComoPagado } from '../database/queries/ventas';
import AulaCard from '../components/AulaCard';
import SyncStatusIcon from '../components/SyncStatusIcon';
import ConfirmModal from '../components/ConfirmModal';
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

  // Estado para el flujo de pago
  const [pagoInfo, setPagoInfo] = useState({ aula: '', turno: '', deudaCents: 0 });
  const [confirmPago, setConfirmPago] = useState({ visible: false, tipo: null, montoCents: 0 });
  const [partialInput, setPartialInput] = useState({ visible: false, montoTexto: '', montoCents: 0 });
  const procesandoRef = useRef(false);

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
    setPagoInfo({ aula, turno, deudaCents });
    
    Alert.alert(
      'Registrar pago',
      `${aula} · Turno ${turno}\nDeuda: S/ ${(deudaCents / 100).toFixed(2)}`,
      [
        {
          text: 'Pagar todo',
          onPress: () => setConfirmPago({ visible: true, tipo: 'total', montoCents: 0 }),
        },
        {
          text: 'Pago parcial',
          onPress: () => setPartialInput({ visible: true, montoTexto: '', montoCents: 0 }),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const formatearMonto = (text) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length > 2)) return partialInput.montoTexto;
    return cleaned;
  };

  const ejecutarPago = async (tipo, montoCents) => {
    if (procesandoRef.current) return;
    procesandoRef.current = true;

    const { aula, turno } = pagoInfo;
    setConfirmPago(prev => ({ ...prev, visible: false }));
    setPartialInput(prev => ({ ...prev, visible: false }));

    try {
      const sales = await db.getAllAsync(
        `SELECT id, total_cents, COALESCE(pagado_cents, 0) as pagado_cents FROM ventas
         WHERE aula = ?
           AND turno = ?
           AND strftime('%Y-%m', fecha_venta) = ?
           AND total_cents > COALESCE(pagado_cents, 0)
           AND anulado_at IS NULL;`,
        [aula, turno, mesSeleccionado]
      );
      const ventaIds = sales.map(s => s.id);

      if (ventaIds.length > 0) {
        await marcarComoPagado(db, { ventaIds, montoCents: tipo === 'parcial' ? montoCents : undefined });
        await loadData();
      }
    } catch (err) {
      console.error('[Salones] Error al registrar pago:', err);
    } finally {
      procesandoRef.current = false;
    }
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

        {/* ConfirmModal: Pago total */}
        <ConfirmModal
          visible={confirmPago.visible && confirmPago.tipo === 'total'}
          title="Confirmar pago"
          message={`¿Confirmar que ${pagoInfo.aula} liquidó toda su deuda de S/ ${(pagoInfo.deudaCents / 100).toFixed(2)}?`}
          confirmText="Sí, pagar todo"
          confirmStyle="success"
          onConfirm={() => ejecutarPago('total', 0)}
          onCancel={() => setConfirmPago(prev => ({ ...prev, visible: false }))}
        />

        {/* ConfirmModal: Pago parcial */}
        <ConfirmModal
          visible={confirmPago.visible && confirmPago.tipo === 'parcial'}
          title="Confirmar pago parcial"
          message={`¿Confirmar pago parcial de S/ ${(confirmPago.montoCents / 100).toFixed(2)} para ${pagoInfo.aula}?\n\nDeuda original: S/ ${(pagoInfo.deudaCents / 100).toFixed(2)}\nDeuda restante: S/ ${((pagoInfo.deudaCents - confirmPago.montoCents) / 100).toFixed(2)}`}
          confirmText="Sí, pagar parcial"
          confirmStyle="success"
          onConfirm={() => ejecutarPago('parcial', confirmPago.montoCents)}
          onCancel={() => setConfirmPago(prev => ({ ...prev, visible: false }))}
        />

        {/* Modal inline: Ingreso de monto para pago parcial */}
        <Modal
          visible={partialInput.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPartialInput({ visible: false, montoTexto: '', montoCents: 0 })}
        >
          <View style={styles.overlay}>
            <View style={styles.partialContent}>
              <CustomText style={styles.partialTitle}>Pago parcial</CustomText>
              <CustomText style={styles.partialSubtitle}>
                {pagoInfo.aula} · Deuda: S/ {(pagoInfo.deudaCents / 100).toFixed(2)}
              </CustomText>

              <View style={styles.inputRow}>
                <CustomText style={styles.signo}>S/</CustomText>
                <TextInput
                  style={styles.input}
                  value={partialInput.montoTexto}
                  onChangeText={(text) => {
                    const formatted = formatearMonto(text);
                    const parsed = parseFloat(formatted);
                    const cents = !isNaN(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
                    setPartialInput({ visible: true, montoTexto: formatted, montoCents: cents });
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  returnKeyType="done"
                  autoFocus={true}
                />
              </View>

              {partialInput.montoTexto.length > 0 && (partialInput.montoCents <= 0 || partialInput.montoCents > pagoInfo.deudaCents) && (
                <CustomText style={styles.errorText}>
                  Ingresa entre S/ 0.01 y S/ {(pagoInfo.deudaCents / 100).toFixed(2)}
                </CustomText>
              )}

              {partialInput.montoCents > 0 && partialInput.montoCents <= pagoInfo.deudaCents && (
                <CustomText style={styles.resumenText}>
                  {partialInput.montoCents >= pagoInfo.deudaCents
                    ? '✓ Cubre la deuda total'
                    : `Pagará S/ ${(partialInput.montoCents / 100).toFixed(2)} · Queda S/ ${((pagoInfo.deudaCents - partialInput.montoCents) / 100).toFixed(2)}`}
                </CustomText>
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn]}
                  activeOpacity={0.7}
                  onPress={() => setPartialInput({ visible: false, montoTexto: '', montoCents: 0 })}
                >
                  <CustomText style={styles.cancelBtnText}>Cancelar</CustomText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.confirmBtn,
                    (partialInput.montoCents <= 0 || partialInput.montoCents > pagoInfo.deudaCents) && styles.disabledBtn,
                  ]}
                  activeOpacity={0.7}
                  disabled={partialInput.montoCents <= 0 || partialInput.montoCents > pagoInfo.deudaCents}
                  onPress={() => {
                    setConfirmPago({ visible: true, tipo: 'parcial', montoCents: partialInput.montoCents });
                  }}
                >
                  <CustomText style={styles.confirmBtnText}>Continuar</CustomText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  /* === Modal Pago Parcial === */
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  partialContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.fondoTarjeta,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  partialTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
    marginBottom: 2,
    textAlign: 'center',
  },
  partialSubtitle: {
    fontSize: 14,
    color: COLORS.textoSecundario,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#f59e0b',
    paddingHorizontal: 14,
    marginBottom: 8,
    width: '100%',
  },
  signo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    textAlign: 'left',
  },
  errorText: {
    fontSize: 12,
    color: COLORS.deudaRojo,
    textAlign: 'center',
    marginBottom: 8,
  },
  resumenText: {
    fontSize: 13,
    color: COLORS.textoSecundario,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  cancelBtn: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  cancelBtnText: {
    color: COLORS.textoSecundario,
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    backgroundColor: '#f59e0b',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.4,
  },
});
