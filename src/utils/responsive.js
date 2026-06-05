import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Categorization of devices by screen width (LDP):
// - Phone: width < 500
// - Medium Tablet: 500 <= width < 750
// - Large Tablet: width >= 750
export let deviceType = 'phone';
if (SCREEN_WIDTH >= 500 && SCREEN_WIDTH < 750) {
  deviceType = 'mediumTablet';
} else if (SCREEN_WIDTH >= 750) {
  deviceType = 'largeTablet';
}

export const isTablet = deviceType !== 'phone';

// Typography Scale Factor
export const fontScaleFactor =
  deviceType === 'largeTablet'
    ? 1.4
    : deviceType === 'mediumTablet'
      ? 1.2
      : 1.0;

/**
 * Escala una tipografía de forma discreta para accesibilidad y legibilidad.
 *
 * @param {number} size - Tamaño de fuente original (ldp)
 * @returns {number} Tamaño de fuente escalado
 */
export function scaleFont(size) {
  return Math.round(size * fontScaleFactor);
}

// Columns configuration for the product grid
export const numColumns =
  deviceType === 'largeTablet'
    ? 5
    : deviceType === 'mediumTablet'
      ? 4
      : 3;

// Products section container height (optimizing rows)
// - Phone: 1 row of products (~92 ldp)
// - Medium Tablet: 2 rows of products (~210 ldp)
// - Large Tablet: 3 rows of products (~360 ldp)
export const productsSectionHeight =
  deviceType === 'largeTablet'
    ? 360
    : deviceType === 'mediumTablet'
      ? 210
      : 92;

// NumPad buttons height configurations
// - Phone: 42 ldp (ergonomic but compact to preserve vertical space for the central cart)
// - Medium Tablet: 50 ldp
// - Large Tablet: 58 ldp
export const keyHeight =
  deviceType === 'largeTablet'
    ? 58
    : deviceType === 'mediumTablet'
      ? 50
      : 42;

export const confirmKeyHeight = keyHeight;
