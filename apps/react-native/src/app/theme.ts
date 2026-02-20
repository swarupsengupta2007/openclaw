import { Platform } from 'react-native';

const headingFontFamily = 'Manrope_700Bold';
const titleFontFamily = 'Manrope_600SemiBold';
const bodyFontFamily = 'Manrope_400Regular';
const bodyMediumFontFamily = 'Manrope_500Medium';

export const colors = {
  // Surfaces
  background: '#F4F5F7',
  backgroundAlt: '#F0F1F4',
  card: '#FFFFFF',
  surface: '#F6F7FA',
  surfaceStrong: '#ECEEF3',

  // Borders
  border: '#E5E7EC',
  borderStrong: '#D6DAE2',

  // Text
  text: '#17181C',
  textSecondary: '#5D6472',
  textTertiary: '#99A0AE',

  // Accent
  accent: '#1D5DD8',
  accentEnd: '#154CAD',
  accentSoft: '#ECF3FF',

  // Semantic
  danger: '#D04B4B',
  dangerEnd: '#B94444',
  dangerSoft: '#FFF2F2',
  warning: '#C8841A',
  warningSoft: '#FFF8EC',
  success: '#2F8C5A',
  successSoft: '#EEF9F3',

  // Code block (dark)
  codeBg: '#15171B',
  codeText: '#E8EAEE',
  codeGreen: '#3FC97A',
  codeDim: '#8F97A5',
};

export const gradients = {
  background: ['#FFFFFF', '#F7F8FA', '#EFF1F5'] as const,
  button: ['#1D5DD8', '#154CAD'] as const,
  buttonDanger: ['#D04B4B', '#B94444'] as const,
  accent: ['#1D5DD8', '#154CAD'] as const,
  statusConnected: ['#2D9A5C', '#1F7F4A'] as const,
  statusWarning: ['#C97D18', '#B16B0B'] as const,
  statusError: ['#D64545', '#BD3D3D'] as const,
};

export const typography = {
  display: {
    fontFamily: headingFontFamily,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  largeTitle: {
    fontFamily: headingFontFamily,
    fontSize: 28,
    letterSpacing: -0.7,
    lineHeight: 34,
  },
  title1: {
    fontFamily: titleFontFamily,
    fontSize: 24,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  title2: {
    fontFamily: titleFontFamily,
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  title3: {
    fontFamily: titleFontFamily,
    fontSize: 18,
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  headline: {
    fontFamily: titleFontFamily,
    fontSize: 16,
    letterSpacing: -0.1,
    lineHeight: 22,
  },
  body: {
    fontFamily: bodyFontFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  callout: {
    fontFamily: bodyFontFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  caption1: {
    fontFamily: bodyMediumFontFamily,
    fontSize: 12,
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  caption2: {
    fontFamily: bodyMediumFontFamily,
    fontSize: 11,
    letterSpacing: 0.4,
    lineHeight: 14,
  },
  mono: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: 18,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 5,
  },
};

export const radii = {
  card: 20,
  button: 14,
  pill: 999,
  input: 14,
  code: 12,
};
