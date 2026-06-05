import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// A device is considered a Tablet if its viewport width is > 600 LDP
export const isTablet = SCREEN_WIDTH > 600;

/**
 * Escala una tipografía de forma discreta para accesibilidad y legibilidad en tablets.
 * Aplica un escalado máximo de 1.2x sólo si el dispositivo entra en la categoría de Tablet (width > 600 LDP).
 *
 * @param {number} size - Tamaño de fuente original (ldp)
 * @returns {number} Tamaño de fuente escalado
 */
export function scaleFont(size) {
  if (isTablet) {
    return Math.round(size * 1.2);
  }
  return size;
}
