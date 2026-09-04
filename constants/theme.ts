/**
 * RuralCare Design System Tokens
 * Source: Stitch Project 5154766711374076031
 */

import type { TextStyle } from 'react-native';

export const Colors = {
  // Primary
  primary: '#087F8C',
  primaryDark: '#00646F',
  primaryLight: '#EFFDFF',
  primaryFixed: '#95F1FF',
  primaryFixedDim: '#79D4E2',

  // Secondary
  secondary: '#16324F',
  secondaryMuted: '#466080',
  secondaryContainer: '#BFD9FE',
  onSecondaryContainer: '#16324F',

  // Tertiary / Success
  tertiary: '#00674A',
  tertiaryContainer: '#EAFFF2',
  onTertiaryContainer: '#005139',
  tertiaryAccent: '#5BAE8B',

  // Surface & Backgrounds
  background: '#F7FAFA',
  surface: '#F7FAFA',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F1F4F4',
  surfaceContainer: '#EBEEEE',
  surfaceContainerHigh: '#E6E9E9',
  surfaceVariant: '#E0E3E3',

  // On-surface & Text
  onSurface: '#181C1D',
  onSurfaceVariant: '#3E494A',
  textSecondary: '#667085',
  outline: '#6E797B',
  outlineVariant: '#BDC9CA',
  outlineLight: '#E3EAEA',

  // Error / Emergency SOS
  error: '#D92D20',
  errorDark: '#BA1A1A',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',
  white: '#FFFFFF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  sos: {
    shadowColor: '#D92D20',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
};

export const Typography = {
  display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 } as TextStyle,
  h1: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,
  h2: { fontSize: 18, fontWeight: '700' } as TextStyle,
  h3: { fontSize: 16, fontWeight: '600' } as TextStyle,
  bodyStrong: { fontSize: 14, fontWeight: '600' } as TextStyle,
  body: { fontSize: 14, fontWeight: '400' } as TextStyle,
  bodyMedium: { fontSize: 13, fontWeight: '500' } as TextStyle,
  caption: { fontSize: 12, fontWeight: '500' } as TextStyle,
  micro: { fontSize: 11, fontWeight: '600' } as TextStyle,
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as TextStyle,
};
