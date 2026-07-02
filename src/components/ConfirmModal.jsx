import CustomText from './CustomText';
import React from 'react';
import { StyleSheet, View, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import COLORS from '../constants/colors';

/**
 * Modal de confirmación reutilizable.
 * @param {Object} props
 * @param {boolean} props.visible Visibilidad del modal
 * @param {string} props.title Título del diálogo
 * @param {string} props.message Mensaje explicativo
 * @param {string} props.confirmText Texto para el botón de confirmar
 * @param {'danger'|'success'|'default'} [props.confirmStyle] Estilo de color del botón confirmar
 * @param {() => void} props.onConfirm Callback al confirmar la acción
 * @param {() => void} props.onCancel Callback al cancelar o cerrar el diálogo
 * @param {boolean} [props.isLoading] Si es verdadero, muestra un spinner de carga en el botón confirmar
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  confirmStyle = 'default',
  onConfirm,
  onCancel,
  isLoading = false,
}) {
  let confirmBtnBgColor = '#3b82f6'; // default: blue
  if (confirmStyle === 'danger') {
    confirmBtnBgColor = COLORS.deudaRojo;
  } else if (confirmStyle === 'success') {
    confirmBtnBgColor = COLORS.pagadoVerde;
  }

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <CustomText style={styles.title}>{title}</CustomText>
          <CustomText style={styles.message}>{message}</CustomText>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <CustomText style={styles.cancelText}>Cancelar</CustomText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: confirmBtnBgColor }]}
              onPress={onConfirm}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <CustomText style={styles.confirmText}>{confirmText}</CustomText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textoPrimario,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.textoSecundario,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: COLORS.borde,
  },
  cancelText: {
    color: COLORS.textoSecundario,
    fontWeight: '600',
  },
  confirmText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
