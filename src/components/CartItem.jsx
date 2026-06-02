import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

/**
 * Representa una fila o elemento en la lista del carrito de ventas.
 * @param {Object} props
 * @param {Object} props.item Elemento del carrito
 * @param {string} props.item.id UUID único del item en el carrito
 * @param {string} props.item.producto_nombre Nombre del producto snapshot
 * @param {number} props.item.cantidad Cantidad agregada
 * @param {number} props.item.precio_unitario_cents Precio unitario en centavos
 * @param {number} props.item.subtotal_cents Subtotal en centavos
 * @param {(id: string) => void} props.onRemove Callback al pulsar para eliminar del carrito
 */
export default function CartItem({ item, onRemove }) {
  const formattedSubtotal = `S/ ${(item.subtotal_cents / 100).toFixed(2)}`;

  return (
    <View style={styles.container}>
      <View style={styles.leftCol}>
        <Text style={styles.name} numberOfLines={1}>
          {item.producto_nombre}
        </Text>
      </View>
      <View style={styles.centerCol}>
        <Text style={styles.quantity}>x{item.cantidad}</Text>
      </View>
      <View style={styles.rightCol}>
        <Text style={styles.subtotal}>{formattedSubtotal}</Text>
        <TouchableOpacity
          style={styles.removeButton}
          activeOpacity={0.7}
          onPress={() => onRemove(item.id)}
        >
          <Text style={styles.removeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  leftCol: {
    flex: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  centerCol: {
    flex: 1,
    alignItems: 'center',
  },
  quantity: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  rightCol: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  subtotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginRight: 12,
  },
  removeButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#fee2e2',
  },
  removeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ef4444',
  },
});
