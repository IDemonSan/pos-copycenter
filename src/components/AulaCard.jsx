import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import COLORS from '../constants/colors';

/**
 * Tarjeta de resumen de deuda por aula.
 * @param {Object} props
 * @param {string} props.aula Nombre del aula (ej: "3° A")
 * @param {string} props.turno Turno (ej: "Mañana")
 * @param {number} props.deuda_cents Deuda en centavos
 * @param {number} props.num_pedidos Cantidad de pedidos pendientes
 * @param {() => void} props.onVerDetalle Callback al pulsar ver detalle
 * @param {() => void} props.onMarcarPagado Callback al pulsar marcar como pagado
 */
export default function AulaCard({ aula, turno, deuda_cents, num_pedidos, onVerDetalle, onMarcarPagado }) {
  const formattedDeuda = `S/ ${(deuda_cents / 100).toFixed(2)}`;

  return (
    <View style={styles.card}>
      {/* Fila Superior */}
      <View style={styles.topRow}>
        <Text style={styles.aulaTitle}>{aula}</Text>
        <View style={styles.turnoBadge}>
          <Text style={styles.turnoText}>{turno}</Text>
        </View>
      </View>

      {/* Fila Central */}
      <View style={styles.centerRow}>
        {deuda_cents > 0 ? (
          <Text style={styles.deudaVal}>{formattedDeuda}</Text>
        ) : (
          <Text style={styles.pagadoVal}>Al día ✓</Text>
        )}
      </View>

      {/* Fila Inferior */}
      <View style={styles.bottomRow}>
        <Text style={styles.pedidosLabel}>
          {num_pedidos} {num_pedidos === 1 ? 'pedido pendiente' : 'pedidos pendientes'}
        </Text>
      </View>

      {/* Acciones */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.detailButton]}
          activeOpacity={0.7}
          onPress={onVerDetalle}
        >
          <Text style={styles.detailButtonText}>Ver detalle</Text>
        </TouchableOpacity>

        {deuda_cents > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.payButton]}
            activeOpacity={0.7}
            onPress={onMarcarPagado}
          >
            <Text style={styles.payButtonText}>Marcar como Pagado</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.fondoTarjeta,
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.borde,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aulaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
  },
  turnoBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  turnoText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textoSecundario,
  },
  centerRow: {
    marginVertical: 10,
  },
  deudaVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.deudaRojo,
  },
  pagadoVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.pagadoVerde,
  },
  bottomRow: {
    marginBottom: 12,
  },
  pedidosLabel: {
    fontSize: 13,
    color: COLORS.textoSecundario,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  detailButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: COLORS.borde,
    marginRight: 8,
  },
  detailButtonText: {
    color: COLORS.textoPrimario,
    fontWeight: '600',
    fontSize: 14,
  },
  payButton: {
    backgroundColor: COLORS.pagadoVerde,
  },
  payButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
