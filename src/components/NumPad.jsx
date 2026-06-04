import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * NumPad — Teclado numérico estático del POS.
 *
 * Props:
 *   onNumber:    (digit: string) => void
 *   onX:         () => void        — activa modo multiplicación
 *   onBackspace: () => void
 *   onConfirmar: () => void
 *   confirmDisabled: boolean       — si true, CONFIRMAR aparece opaco e inactivo
 *   isModoMultiplicacion: boolean  — si true, el botón X se resalta
 */
export default function NumPad({
  onNumber,
  onX,
  onBackspace,
  onConfirmar,
  confirmDisabled = false,
  isModoMultiplicacion = false,
}) {
  const insets = useSafeAreaInsets();

  // Filas de la grilla numérica
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['X', '0', '⌫'],
  ];

  const handleKeyPress = (key) => {
    if (key === 'X')  { onX(); return; }
    if (key === '⌫') { onBackspace(); return; }
    onNumber(key);
  };

  const getKeyStyle = (key) => {
    if (key === '⌫') return [styles.key, styles.keyBackspace];
    if (key === 'X')  return [styles.key, isModoMultiplicacion ? styles.keyXActivo : styles.keyX];
    return styles.key;
  };

  const getKeyTextStyle = (key) => {
    if (key === '⌫') return [styles.keyText, styles.keyBackspaceText];
    if (key === 'X')  return [styles.keyText, isModoMultiplicacion ? styles.keyXTextoActivo : styles.keyXTexto];
    return styles.keyText;
  };

  return (
    // paddingBottom dinámico para NO quedar detrás de la barra de navegación inferior
    <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>

      {/* Grilla numérica 3×4 */}
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={getKeyStyle(key)}
              onPress={() => handleKeyPress(key)}
              activeOpacity={0.7}
            >
              <Text style={getKeyTextStyle(key)}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {/* Botón CONFIRMAR — ancho completo, separado de la grilla */}
      <TouchableOpacity
        style={[
          styles.confirmKey,
          confirmDisabled && styles.confirmKeyDisabled,
        ]}
        onPress={onConfirmar}
        disabled={confirmDisabled}
        activeOpacity={0.8}
      >
        <Text style={styles.confirmText}>CONFIRMAR  ✔</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },

  // ── Fila de teclas ───────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  // ── Tecla genérica ───────────────────────────────────────────────────────
  key: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
  },

  // ── Tecla backspace (⌫) ──────────────────────────────────────────────────
  keyBackspace: {
    backgroundColor: '#fee2e2',
  },
  keyBackspaceText: {
    color: '#dc2626',
    fontSize: 20,
  },

  // ── Tecla X (multiplicar) — inactiva ─────────────────────────────────────
  keyX: {
    backgroundColor: '#eff6ff',
  },
  keyXTexto: {
    color: '#3b82f6',
    fontWeight: '700',
  },

  // ── Tecla X (multiplicar) — activa ───────────────────────────────────────
  keyXActivo: {
    backgroundColor: '#3b82f6',
  },
  keyXTextoActivo: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // ── Botón CONFIRMAR ───────────────────────────────────────────────────────
  confirmKey: {
    width: '100%',
    height: 54,
    borderRadius: 8,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
  },
  confirmKeyDisabled: {
    backgroundColor: '#d1d5db',
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
