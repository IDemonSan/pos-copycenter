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

// Typography Scale Factor: 1.6 for large tablets, 1.2 for medium, 1.0 for phones
export const fontScaleFactor =
  deviceType === 'largeTablet' ? 1.6 : deviceType === 'mediumTablet' ? 1.2 : 1.0;

// Layout spacing scale factor (margins, padding, border-radius)
export const layoutScaleFactor =
  deviceType === 'largeTablet' ? 1.5 : deviceType === 'mediumTablet' ? 1.2 : 1.0;

/**
 * Escala una tipografía de forma discreta para accesibilidad y legibilidad.
 *
 * @param {number} size - Tamaño de fuente original (ldp)
 * @returns {number} Tamaño de fuente escalado
 */
export function scaleFont(size) {
  return Math.round(size * fontScaleFactor);
}

/**
 * Escala medidas de maquetación (paddings, margins, etc.) para mantener proporciones en tablets.
 *
 * @param {number} size - Medida original (ldp)
 * @returns {number} Medida escalada
 */
export function scaleLayout(size) {
  return Math.round(size * layoutScaleFactor);
}

// Columns configuration for the product grid
// - Phone: 2 columns (slimmer, name on 1st line, price on 2nd)
// - Medium Tablet: 4 columns
// - Large Tablet: 5 columns
export const numColumns = deviceType === 'largeTablet' ? 5 : deviceType === 'mediumTablet' ? 4 : 2;

// Height of a product button:
// - Phone: 55 ldp (slim buttons)
// - Medium Tablet: 80 ldp
// - Large Tablet: 100 ldp
export const productButtonHeight =
  deviceType === 'largeTablet' ? 100 : deviceType === 'mediumTablet' ? 80 : 55;

// Products section container height (optimizing rows)
// - Phone: 1 row of products (65 ldp)
// - Medium Tablet: 2 rows of products (190 ldp)
// - Large Tablet: 3 rows of products (340 ldp)
export const productsSectionHeight =
  deviceType === 'largeTablet' ? 340 : deviceType === 'mediumTablet' ? 190 : 65;

// NumPad buttons height configurations
// - Phone: 42 ldp (ergonomic but compact)
// - Medium Tablet: 50 ldp
// - Large Tablet: 58 ldp
export const keyHeight =
  deviceType === 'largeTablet' ? 58 : deviceType === 'mediumTablet' ? 50 : 42;

export const confirmKeyHeight = keyHeight;
