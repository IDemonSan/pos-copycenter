import * as Haptics from 'expo-haptics';

/**
 * Confirmar que un producto se agregó al carrito.
 * Utiliza un impacto suave (Light).
 * @returns {Promise<void>}
 */
export async function hapticProductoAgregado() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {
    console.warn('[Haptic] Error al ejecutar hapticProductoAgregado:', e);
  }
}

/**
 * Confirmar que la venta completa se guardó exitosamente.
 * Utiliza un impacto fuerte (Heavy).
 * @returns {Promise<void>}
 */
export async function hapticVentaConfirmada() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch (e) {
    console.warn('[Haptic] Error al ejecutar hapticVentaConfirmada:', e);
  }
}

/**
 * Advertencia: buffer vacío al intentar agregar un producto.
 * Utiliza una notificación de advertencia (Warning).
 * @returns {Promise<void>}
 */
export async function hapticBufferVacio() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (e) {
    console.warn('[Haptic] Error al ejecutar hapticBufferVacio:', e);
  }
}

/**
 * Error: operación fallida.
 * Utiliza una notificación de error (Error).
 * @returns {Promise<void>}
 */
export async function hapticError() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (e) {
    console.warn('[Haptic] Error al ejecutar hapticError:', e);
  }
}
