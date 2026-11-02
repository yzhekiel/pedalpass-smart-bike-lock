import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { StyleProp, TextStyle } from 'react-native';

type Props = {
  /** Material icon name. Underscores are allowed (e.g. "qr_code_scanner"), same as the web app. */
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

export function Icon({ name, size = 20, color = '#0a1b38', style }: Props) {
  const glyph = name.replace(/_/g, '-') as keyof typeof MaterialIcons.glyphMap;
  return <MaterialIcons name={glyph} size={size} color={color} style={style} />;
}
