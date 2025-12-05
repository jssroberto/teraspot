/**
 * Enhanced theme system with modern colors, gradients, spacing, and animation tokens
 * Designed for premium mobile-first experience with glassmorphism and vibrant aesthetics
 */

import { Platform } from 'react-native';

// Modern vibrant color palette using HSL for better control
const tintColorLight = 'hsl(217, 91%, 60%)'; // Vibrant blue
const tintColorDark = 'hsl(217, 91%, 70%)';

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#687076',
    background: 'hsl(0, 0%, 98%)',
    backgroundSecondary: 'hsl(0, 0%, 95%)',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,

    // Semantic colors with gradients
    success: 'hsl(142, 76%, 36%)', // Emerald green
    successLight: 'hsl(142, 76%, 45%)',
    successGradientStart: 'hsl(142, 76%, 36%)',
    successGradientEnd: 'hsl(173, 58%, 39%)', // Teal

    error: 'hsl(0, 84%, 60%)', // Rose red
    errorLight: 'hsl(0, 84%, 70%)',
    errorGradientStart: 'hsl(0, 84%, 60%)',
    errorGradientEnd: 'hsl(14, 91%, 58%)', // Orange-red

    warning: 'hsl(38, 92%, 50%)', // Amber
    info: 'hsl(199, 89%, 48%)', // Sky blue

    // Glassmorphism
    glassBackground: 'rgba(255, 255, 255, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.3)',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.5)',
    cardBackground: '#ffffff',
    cardBorder: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    background: 'hsl(220, 13%, 9%)', // Deep charcoal
    backgroundSecondary: 'hsl(220, 13%, 12%)',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,

    // Semantic colors with gradients
    success: 'hsl(142, 76%, 45%)',
    successLight: 'hsl(142, 76%, 55%)',
    successGradientStart: 'hsl(142, 76%, 45%)',
    successGradientEnd: 'hsl(173, 58%, 49%)',

    error: 'hsl(0, 84%, 65%)',
    errorLight: 'hsl(0, 84%, 75%)',
    errorGradientStart: 'hsl(0, 84%, 65%)',
    errorGradientEnd: 'hsl(14, 91%, 63%)',

    warning: 'hsl(38, 92%, 60%)',
    info: 'hsl(199, 89%, 58%)',

    // Glassmorphism
    glassBackground: 'rgba(255, 255, 255, 0.1)',
    glassBorder: 'rgba(255, 255, 255, 0.2)',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.7)',
    cardBackground: 'hsl(220, 13%, 15%)',
    cardBorder: 'rgba(255, 255, 255, 0.1)',
  },
};

// Spacing scale (base unit: 4px)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

// Border radius scale
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: 9999,
};

// Shadow/Elevation styles
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 12,
  },
};

// Animation timing constants
export const Animations = {
  fast: 150,
  normal: 300,
  slow: 500,
  verySlow: 1000,

  // Easing curves (for react-native-reanimated)
  easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  spring: 'spring',
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
