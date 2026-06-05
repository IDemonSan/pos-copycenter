import React from 'react';
import { Text as RNText } from 'react-native';
import { scaleFont } from '../utils/responsive';

/**
 * Componente de texto responsivo que escala automáticamente el fontSize y lineHeight
 * por un factor discreto de 1.2x sólo si el dispositivo califica como tablet.
 */
export default function CustomText({ style, children, ...props }) {
  const normalizeStyle = (styleObj) => {
    if (!styleObj) return styleObj;

    if (Array.isArray(styleObj)) {
      return styleObj.map((s) => normalizeStyle(s));
    }

    if (typeof styleObj === 'object') {
      const newStyle = { ...styleObj };
      if (typeof newStyle.fontSize === 'number') {
        newStyle.fontSize = scaleFont(newStyle.fontSize);
      }
      if (typeof newStyle.lineHeight === 'number') {
        newStyle.lineHeight = scaleFont(newStyle.lineHeight);
      }
      return newStyle;
    }

    return styleObj;
  };

  const dynamicStyle = normalizeStyle(style);

  return (
    <RNText style={dynamicStyle} {...props}>
      {children}
    </RNText>
  );
}
