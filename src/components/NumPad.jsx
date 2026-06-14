import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import CustomText from './CustomText';
import { keyHeight } from '../utils/responsive';

/**
 * NumPad — Teclado numérico estilo calculadora para el POS.
 *
 * Layout:
 * ┌───┬───┬───┬───┐
 * │ 7 │ 8 │ 9 │ × │
 * ├───┼───┼───┼───┤
 * │ 4 │ 5 │ 6 │ + │
 * ├───┼───┼───┼───┤
 * │ 1 │ 2 │ 3 │ ⌫ │
 * ├───┼───┼───┼───┤
 * │ C │ 0 │ CONFIRMAR  │
 * └───┴───┴───────┘
 *
 * Props:
 *   onNumber:    (digit: string) => void
 *   onX:         () => void        — activa modo multiplicación
 *   onPlus:      () => void        — agrega operador suma a la expresión
 *   onBackspace: () => void
 *   onClear:     () => void        — limpia todo el buffer
 *   onConfirmar: () => void
 *   confirmDisabled: boolean
 *   isModoMultiplicacion: boolean
 */
export default function NumPad({
  onNumber,
  onX,
  onPlus,
  onBackspace,
  onClear,
  onConfirmar,
  confirmDisabled = false,
  isModoMultiplicacion = false,
}) {

  const handleKeyPress = (key) => {
    switch (key) {
      case '×':  onX(); return;
      case '+':  if (onPlus) onPlus(); return;
      case '⌫': onBackspace(); return;
      case 'C':  if (onClear) onClear(); return;
      case 'CONFIRMAR': onConfirmar(); return;
      default:   onNumber(key);
    }
  };

  const getKeyStyle = (key) => {
    const base = [styles.key, { height: keyHeight }];
    switch (key) {
      case '×':
        return [...base, isModoMultiplicacion ? styles.keyOpActivo : styles.keyOp, styles.keyOpX];
      case '+':
        return [...base, styles.keyOp, styles.keyOpPlus];
      case '⌫':
        return [...base, styles.keyBackspace];
      case 'C':
        return [...base, styles.keyClear];
      case 'CONFIRMAR':
        return [...base, styles.keyConfirmar, confirmDisabled && styles.keyConfirmarDisabled];
      default:
        return base;
    }
  };

  const getKeyTextStyle = (key) => {
    switch (key) {
      case '×':
        return [styles.keyText, isModoMultiplicacion ? styles.keyOpTextoActivo : styles.keyOpTexto, styles.keyOpXTexto];
      case '+':
        return [styles.keyText, styles.keyOpTexto, styles.keyOpPlusTexto];
      case '⌫':
        return [styles.keyText, styles.keyBackspaceText];
      case 'C':
        return [styles.keyText, styles.keyClearText];
      case 'CONFIRMAR':
        return [styles.keyText, styles.keyConfirmarText];
      default:
        return styles.keyText;
    }
  };

  const rows = [
    ['7', '8', '9', '×'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '⌫'],
  ];

  const lastRow = ['C', '0', 'CONFIRMAR'];

  return (
    <View style={styles.container}>
      {/* Filas 1-3: 4 columnas cada una */}
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={getKeyStyle(key)}
              onPress={() => handleKeyPress(key)}
              activeOpacity={0.7}
            >
              <CustomText style={getKeyTextStyle(key)}>{key}</CustomText>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {/* Fila 4: C - 0 - CONFIRMAR (span 2 columnas) */}
      <View style={styles.row}>
        {lastRow.map((key) => {
          const isConfirmar = key === 'CONFIRMAR';
          return (
            <TouchableOpacity
              key={key}
              style={[
                getKeyStyle(key),
                isConfirmar && { flex: 2 },
              ]}
              onPress={() => handleKeyPress(key)}
              disabled={isConfirmar && confirmDisabled}
              activeOpacity={0.8}
            >
              <CustomText style={getKeyTextStyle(key)}>
                {isConfirmar ? '✔' : key}
              </CustomText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    width: '100%',
  },

  // ── Fila de teclas ───────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  // ── Tecla genérica (números) ──────────────────────────────────────────────
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  keyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },

  // ── Teclas de operación (×, +) ────────────────────────────────────────────
  keyOp: {
    backgroundColor: '#eff6ff',
  },
  keyOpX: {
    // Multiplicar
  },
  keyOpPlus: {
    backgroundColor: '#ecfdf5',
  },
  keyOpTexto: {
    fontWeight: '700',
    fontSize: 22,
  },
  keyOpXTexto: {
    color: '#2563eb',
  },
  keyOpPlusTexto: {
    color: '#059669',
  },
  keyOpActivo: {
    backgroundColor: '#3b82f6',
  },
  keyOpTextoActivo: {
    color: '#ffffff',
  },

  // ── Tecla backspace (⌫) ──────────────────────────────────────────────────
  keyBackspace: {
    backgroundColor: '#fef2f2',
  },
  keyBackspaceText: {
    color: '#dc2626',
    fontSize: 18,
  },

  // ── Tecla clear (C) ──────────────────────────────────────────────────────
  keyClear: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  keyClearText: {
    color: '#4b5563',
    fontWeight: '700',
    fontSize: 16,
  },

  // ── Botón CONFIRMAR en grilla ─────────────────────────────────────────────
  keyConfirmar: {
    backgroundColor: '#22c55e',
  },
  keyConfirmarDisabled: {
    backgroundColor: '#d1d5db',
  },
  keyConfirmarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 20,
  },
});
