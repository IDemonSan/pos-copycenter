import CustomText from '../components/CustomText';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useDb } from '../context/DbContext';
import {
  getTotalPorDia,
  getTotalPorMes,
  getTotalMesAnterior,
} from '../database/queries/reportes';
import COLORS from '../constants/colors';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

function formatearFecha(fechaStr) {
  try {
    const d = new Date(fechaStr + 'T12:00:00');
    return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  } catch {
    return fechaStr;
  }
}

function obtenerFechaLocal() {
  const d = new Date();
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function obtenerAyer() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export default function MetricasScreen() {
  const { db } = useDb();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const hoyStr = obtenerFechaLocal();
  const ayerStr = obtenerAyer();
  const mesActualStr = hoyStr.slice(0, 7);

  const [loading, setLoading] = useState(true);
  const [hoy, setHoy] = useState({ total_cents: 0, pedidos: 0 });
  const [ayer, setAyer] = useState({ total_cents: 0, pedidos: 0 });
  const [mesActual, setMesActual] = useState({ total_cents: 0, pedidos: 0 });
  const [mesAnterior, setMesAnterior] = useState({ total_cents: 0, mes: '' });

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const dataHoy = await getTotalPorDia(db, hoyStr);
      setHoy(dataHoy);

      const dataAyer = await getTotalPorDia(db, ayerStr);
      setAyer(dataAyer);

      const dataMesActual = await getTotalPorMes(db, mesActualStr);
      setMesActual(dataMesActual);

      const dataMesAnterior = await getTotalMesAnterior(db, mesActualStr);
      setMesAnterior(dataMesAnterior);
    } catch (err) {
      console.error('[Metricas] Error al cargar datos:', err);
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

  const diffHoyAyer = hoy.total_cents - ayer.total_cents;
  const diffHoyAyerText = diffHoyAyer >= 0
    ? `+S/ ${(diffHoyAyer / 100).toFixed(2)}`
    : `-S/ ${(Math.abs(diffHoyAyer) / 100).toFixed(2)}`;
  const diffHoyAyerColor = diffHoyAyer >= 0 ? COLORS.pagadoVerde : COLORS.deudaRojo;

  const diffMes = mesActual.total_cents - mesAnterior.total_cents;
  const diffMesText = diffMes >= 0
    ? `+S/ ${(diffMes / 100).toFixed(2)}`
    : `-S/ ${(Math.abs(diffMes) / 100).toFixed(2)}`;
  const diffMesColor = diffMes >= 0 ? COLORS.pagadoVerde : COLORS.deudaRojo;

  return (
    <View style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* ─── COMPARATIVA DIARIA: HOY vs AYER ─── */}
        <View style={styles.card}>
          <CustomText style={styles.cardTitle}>📊 Comparativa Diaria</CustomText>

          <View style={styles.dayComparison}>
            <View style={styles.dayColumn}>
              <CustomText style={styles.dayLabel}>HOY</CustomText>
              <CustomText style={styles.dayDate}>{formatearFecha(hoyStr)}</CustomText>
              <CustomText style={styles.dayAmount}>S/ {(hoy.total_cents / 100).toFixed(2)}</CustomText>
              <CustomText style={styles.daySubtext}>{hoy.pedidos} pedido(s)</CustomText>
            </View>

            <View style={styles.vsColumn}>
              <CustomText style={styles.vsText}>VS</CustomText>
              <CustomText style={[styles.diffText, { color: diffHoyAyerColor }]}>
                {diffHoyAyerText}
              </CustomText>
            </View>

            <View style={styles.dayColumn}>
              <CustomText style={styles.dayLabel}>AYER</CustomText>
              <CustomText style={styles.dayDate}>{formatearFecha(ayerStr)}</CustomText>
              <CustomText style={styles.dayAmount}>S/ {(ayer.total_cents / 100).toFixed(2)}</CustomText>
              <CustomText style={styles.daySubtext}>{ayer.pedidos} pedido(s)</CustomText>
            </View>
          </View>

          <TouchableOpacity
            style={styles.verMasBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MetricasDetalleDias')}
          >
            <CustomText style={styles.verMasText}>Ver detalle por días →</CustomText>
          </TouchableOpacity>
        </View>

        {/* ─── COMPARATIVA MENSUAL ─── */}
        <View style={styles.card}>
          <CustomText style={styles.cardTitle}>📆 Comparativa Mensual</CustomText>

          <View style={styles.monthComparison}>
            <View style={styles.monthRow}>
              <CustomText style={styles.monthLabel}>Mes actual</CustomText>
              <CustomText style={styles.monthAmount}>
                S/ {(mesActual.total_cents / 100).toFixed(2)}
              </CustomText>
              <CustomText style={styles.daySubtext}>{mesActual.pedidos} pedido(s)</CustomText>
            </View>

            {mesAnterior.mes && (
              <>
                <View style={styles.divider} />
                <View style={styles.monthRow}>
                  <CustomText style={styles.monthLabel}>Mes anterior</CustomText>
                  <CustomText style={styles.monthAmount}>
                    S/ {(mesAnterior.total_cents / 100).toFixed(2)}
                  </CustomText>
                </View>
                <View style={styles.diffRow}>
                  <CustomText style={styles.diffLabel}>Diferencia:</CustomText>
                  <CustomText style={[styles.diffValue, { color: diffMesColor }]}>
                    {diffMesText}
                  </CustomText>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.verMasBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MetricasDetalleMeses')}
          >
            <CustomText style={styles.verMasText}>Ver detalle por meses →</CustomText>
          </TouchableOpacity>
        </View>

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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borde,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
    marginBottom: 4,
  },

  // ── Comparativa diaria ────────────────────────────────────────────────────
  dayComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
    letterSpacing: 1,
    marginBottom: 4,
  },
  dayDate: {
    fontSize: 11,
    color: COLORS.textoSecundario,
    marginBottom: 8,
  },
  dayAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textoPrimario,
  },
  daySubtext: {
    fontSize: 12,
    color: COLORS.textoSecundario,
    marginTop: 4,
  },
  vsColumn: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  vsText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
    marginBottom: 6,
  },
  diffText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Comparativa mensual ───────────────────────────────────────────────────
  monthComparison: {
    marginTop: 12,
  },
  monthRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textoSecundario,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  monthAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textoPrimario,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginVertical: 4,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  diffLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textoSecundario,
    marginRight: 8,
  },
  diffValue: {
    fontSize: 16,
    fontWeight: '900',
  },

  // ── Botón Ver más ───────────────────────────────────────────────────────
  verMasBtn: {
    marginTop: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  verMasText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
});
