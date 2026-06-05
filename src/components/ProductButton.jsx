import React, { useRef, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Animated } from 'react-native';
import CustomText from './CustomText';

/**
 * Botón para representar un producto en la grilla del POS con animación shake.
 * @param {Object} props
 * @param {Object} props.producto Datos del producto
 * @param {string} props.producto.id UUID del producto
 * @param {string} props.producto.nombre Nombre del producto
 * @param {number} props.producto.precio_cents Precio en centavos
 * @param {number} props.producto.is_variable 1 = variable, 0 = fijo
 * @param {(producto: Object) => void} props.onPress Callback al pulsar el producto
 * @param {number} props.shakeSignal Señal para disparar la animación de shake
 */
export default function ProductButton({ producto, onPress, shakeSignal }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Animación shake: oscila X: 0 -> -10 -> 10 -> -8 -> 8 -> -4 -> 4 -> 0
    Animated.sequence([
      Animated.timing(translateX, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeSignal, translateX]);

  const displayPrice =
    producto.is_custom === 1
      ? 'Caso especial'
      : producto.is_variable === 1
        ? 'Precio variable'
        : `S/ ${(producto.precio_cents / 100).toFixed(2)}`;

  const isSpecial = producto.is_variable === 1 || producto.is_custom === 1;

  return (
    <Animated.View style={{ transform: [{ translateX }] }}>
      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.7}
        onPress={() => onPress(producto)}
      >
        <CustomText style={styles.name} numberOfLines={2}>
          {producto.nombre}
        </CustomText>
        <CustomText style={[styles.price, isSpecial && styles.variablePrice]}>
          {displayPrice}
        </CustomText>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 80,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    margin: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  price: {
    fontSize: 12,
    color: '#6b7280',
  },
  variablePrice: {
    fontStyle: 'italic',
    color: '#4b5563',
  },
});
