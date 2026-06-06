import CustomText from '../components/CustomText';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import { getResumenDia, getDeudaPorAula } from '../database/queries/reportes';
import COLORS from '../constants/colors';

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

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

export default function HomeScreen() {
  const { db } = useDb();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [resumenDia, setResumenDia] = useState({ total_dia_cents: 0, por_aula: [] });
  const [pedidosCount, setPedidosCount] = useState(0);
  const [deudas, setDeudas] = useState([]);

  const obtenerFechaLocal = () => {
    const d = new Date();
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  };

  const hoy = obtenerFechaLocal();
  const mesActual = hoy.slice(0, 7); // "YYYY-MM"

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      // 1. Cargar resumen del día
      const resDia = await getResumenDia(db, hoy);
      setResumenDia(resDia);

      // 2. Cargar conteo de pedidos de hoy
      const ordersRes = await db.getFirstAsync(
        "SELECT COUNT(*) as count FROM ventas WHERE fecha_venta = ? AND anulado_at IS NULL;",
        [hoy]
      );
      setPedidosCount(ordersRes?.count ?? 0);

      // 3. Cargar deudas del mes actual ordenadas desc, max 5
      const dataDeudas = await getDeudaPorAula(db, mesActual);
      // getDeudaPorAula ya devuelve las aulas ordenadas por deuda desc
      setDeudas(dataDeudas.slice(0, 5));

    } catch (err) {
      console.error('[Home] Error al cargar resumen:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, db]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const hasSalesOrDebts = resumenDia.total_dia_cents > 0 || deudas.length > 0;

  return (
    <View style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Saludo y Fecha */}
        <View style={styles.greetingHeader}>
          <CustomText style={styles.greetingText}>{getGreeting()},</CustomText>
          <CustomText style={styles.dateText}>{formatLongDate()}</CustomText>
        </View>

        {!hasSalesOrDebts ? (
          <View style={styles.welcomeCard}>
            <CustomText style={styles.welcomeTitle}>¡Bienvenida! 👋</CustomText>
            <CustomText style={styles.welcomeText}>
              Toca 'Nueva Venta' para registrar tu primer pedido.
            </CustomText>
          </View>
        ) : (
          <>
            {/* TARJETA RESUMEN DEL DÍA */}
            <View style={styles.resumenCard}>
              <CustomText style={styles.resumenLabel}>Vendido hoy</CustomText>
              <CustomText style={styles.resumenAmount}>
                S/ {(resumenDia.total_dia_cents / 100).toFixed(2)}
              </CustomText>
              <CustomText style={styles.resumenOrders}>
                {pedidosCount} {pedidosCount === 1 ? 'pedido registrado' : 'pedidos registrados'}
              </CustomText>
            </View>

            {/* SECCIÓN AULAS CON DEUDA */}
            <View style={styles.sectionHeader}>
              <CustomText style={styles.sectionTitle}>AULAS CON DEUDA</CustomText>
              <TouchableOpacity
                onPress={() => navigation.navigate('Salones')}
              >
                <CustomText style={styles.viewAllText}>Ver todas →</CustomText>
              </TouchableOpacity>
            </View>

            {deudas.length === 0 ? (
              <CustomText style={styles.noDebtsText}>Todas las aulas están al día ✓</CustomText>
            ) : (
              deudas.map((item) => {
                const totalSoles = (item.deuda_cents / 100).toFixed(2);
                return (
                  <View
                    key={`${item.aula}-${item.turno}`}
                    style={styles.compactCard}
                  >
                    <View style={styles.compactCardLeft}>
                      <CustomText style={styles.compactAula}>{item.aula}</CustomText>
                      <CustomText style={styles.compactTurno}>Turno: {item.turno}</CustomText>
                    </View>
                    
                    <View style={styles.compactCardRight}>
                      <CustomText style={styles.compactAmount}>S/ {totalSoles}</CustomText>
                      <TouchableOpacity
                        style={styles.compactButton}
                        activeOpacity={0.7}
                        onPress={() =>
                          navigation.navigate('AulaDetail', {
                            aula: item.aula,
                            turno: item.turno,
                            mes: mesActual,
                          })
                        }
                      >
                        <CustomText style={styles.compactButtonText}>Ver</CustomText>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* BOTÓN GRANDE NUEVA VENTA */}
        <TouchableOpacity
          style={styles.nuevaVentaButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('POS')}
        >
          <CustomText style={styles.nuevaVentaText}>+ NUEVA VENTA</CustomText>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.fondoPantalla,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingHeader: {
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.textoSecundario,
    marginTop: 4,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borde,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 15,
    color: COLORS.textoSecundario,
    textAlign: 'center',
    lineHeight: 22,
  },
  resumenCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borde,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  resumenLabel: {
    fontSize: 14,
    color: COLORS.textoSecundario,
    fontWeight: '600',
  },
  resumenAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.textoPrimario,
    marginVertical: 6,
  },
  resumenOrders: {
    fontSize: 14,
    color: COLORS.textoSecundario,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
    letterSpacing: 1,
  },
  viewAllText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  noDebtsText: {
    fontSize: 15,
    color: COLORS.pagadoVerde,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  compactCardLeft: {
    flex: 1,
  },
  compactAula: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
  },
  compactTurno: {
    fontSize: 12,
    color: COLORS.textoSecundario,
    marginTop: 2,
  },
  compactCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.deudaRojo,
    marginRight: 12,
  },
  compactButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: COLORS.borde,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  compactButtonText: {
    color: COLORS.textoPrimario,
    fontWeight: '600',
    fontSize: 13,
  },
  nuevaVentaButton: {
    height: 54,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  nuevaVentaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
