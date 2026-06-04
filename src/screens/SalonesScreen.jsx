import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { getDeudaPorAula } from '../database/queries/reportes';
import { marcarComoPagado } from '../database/queries/ventas';
import AulaCard from '../components/AulaCard';
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

  const mesActual = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const anio = new Date().getFullYear();
  const mesIndice = new Date().getMonth();
  const nombreMes = `${MESES[mesIndice]} ${anio}`;

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      // 1. Obtener aulas con deuda del mes actual
      const dataDeudas = await getDeudaPorAula(db, mesActual);
      
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

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, db]);

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
                [aula, turno, mesActual]
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
    navigation.navigate('AulaDetail', { aula, turno, mes: mesActual });
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Salones — {nombreMes}</Text>
        </View>

        {totalAulasRegistradas === 0 && alDia.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aún no hay ventas este mes. Ve al POS para registrar.</Text>
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
                <Text style={styles.sectionTitle}>Aulas con Deuda ({conDeuda.length})</Text>
              </View>
            }
            ListFooterComponent={
              <View style={styles.footerSection}>
                <TouchableOpacity
                  style={styles.collapseHeader}
                  activeOpacity={0.7}
                  onPress={() => setAlDiaExpanded(!alDiaExpanded)}
                >
                  <Text style={styles.sectionTitle}>Al día ({alDia.length})</Text>
                  <Text style={styles.collapseIcon}>{alDiaExpanded ? '▲' : '▼'}</Text>
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
  header: {
    height: 56,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
