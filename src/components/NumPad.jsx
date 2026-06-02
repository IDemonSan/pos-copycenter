import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

/**
 * Teclado numérico estático y permanente para la pantalla de POS.
 * @param {Object} props
 * @param {(digit: string) => void} props.onDigit Callback al pulsar un dígito ("0"-"9" o "00")
 * @param {() => void} props.onBackspace Callback al pulsar borrar (⌫)
 * @param {() => void} props.onConfirmar Callback al pulsar confirmar venta
 * @param {boolean} props.confirmDisabled Si es verdadero, el botón confirmar se muestra deshabilitado (opacidad 0.4)
 */
export default function NumPad({ onDigit, onBackspace, onConfirmar, confirmDisabled }) {
  const row1 = ['7', '8', '9'];
  const row2 = ['4', '5', '6'];
  const row3 = ['1', '2', '3'];

  return (
    <View style={styles.container}>
      {/* Fila 1 */}
      <View style={styles.row}>
        {row1.map((num) => (
          <TouchableOpacity
            key={num}
            style={styles.key}
            activeOpacity={0.7}
            onPress={() => onDigit(num)}
          >
            <Text style={styles.keyText}>{num}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fila 2 (incluye retroceso) */}
      <View style={styles.row}>
        {row2.map((num) => (
          <TouchableOpacity
            key={num}
            style={styles.key}
            activeOpacity={0.7}
            onPress={() => onDigit(num)}
          >
            <Text style={styles.keyText}>{num}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.key, styles.backspaceKey]}
          activeOpacity={0.7}
          onPress={onBackspace}
        >
          <Text style={styles.backspaceText}>⌫</Text>
        </TouchableOpacity>
      </View>

      {/* Fila 3 */}
      <View style={styles.row}>
        {row3.map((num) => (
          <TouchableOpacity
            key={num}
            style={styles.key}
            activeOpacity={0.7}
            onPress={() => onDigit(num)}
          >
            <Text style={styles.keyText}>{num}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fila 4 (0, 00 y Confirmar) */}
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.key}
          activeOpacity={0.7}
          onPress={() => onDigit('0')}
        >
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.key}
          activeOpacity={0.7}
          onPress={() => onDigit('00')}
        >
          <Text style={styles.keyText}>00</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.confirmKey,
            confirmDisabled ? styles.confirmDisabled : styles.confirmEnabled,
          ]}
          activeOpacity={confirmDisabled ? 1 : 0.7}
          disabled={confirmDisabled}
          onPress={onConfirmar}
        >
          <Text style={styles.confirmText}>CONFIRMAR VENTA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  key: {
    flex: 1,
    height: 58,
    minWidth: 58,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1f2937',
  },
  backspaceKey: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  backspaceText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  confirmKey: {
    flex: 2,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
  },
  confirmEnabled: {
    backgroundColor: '#22c55e',
    borderColor: '#16a34a',
  },
  confirmDisabled: {
    backgroundColor: '#e5e7eb',
    borderColor: '#d1d5db',
    opacity: 0.4,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
