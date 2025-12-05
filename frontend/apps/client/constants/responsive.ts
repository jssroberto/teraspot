/**
 * Responsive design utilities for mobile-first development
 * Provides breakpoints, scaling functions, and device detection
 */

import { Dimensions, Platform, PixelRatio } from 'react-native';

// Get device dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Breakpoints (in pixels)
export const Breakpoints = {
    mobile: 0,
    tablet: 768,
    desktop: 1024,
    wide: 1440,
};

// Device type detection
export const DeviceType = {
    isMobile: SCREEN_WIDTH < Breakpoints.tablet,
    isTablet: SCREEN_WIDTH >= Breakpoints.tablet && SCREEN_WIDTH < Breakpoints.desktop,
    isDesktop: SCREEN_WIDTH >= Breakpoints.desktop,
    isWeb: Platform.OS === 'web',
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
};

// Base dimensions for scaling (iPhone 11 Pro as reference)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Scale a value based on screen width
 * @param size - The size to scale
 * @returns Scaled size
 */
export function scaleWidth(size: number): number {
    return (SCREEN_WIDTH / BASE_WIDTH) * size;
}

/**
 * Scale a value based on screen height
 * @param size - The size to scale
 * @returns Scaled size
 */
export function scaleHeight(size: number): number {
    return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
}

/**
 * Scale font size with moderate scaling
 * @param size - Font size to scale
 * @returns Scaled font size
 */
export function scaleFontSize(size: number): number {
    const scale = SCREEN_WIDTH / BASE_WIDTH;
    const newSize = size * scale;
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

/**
 * Get responsive value based on screen size
 * @param mobile - Value for mobile screens
 * @param tablet - Value for tablet screens (optional)
 * @param desktop - Value for desktop screens (optional)
 * @returns Appropriate value for current screen size
 */
export function responsive<T>(
    mobile: T,
    tablet?: T,
    desktop?: T
): T {
    if (DeviceType.isDesktop && desktop !== undefined) {
        return desktop;
    }
    if (DeviceType.isTablet && tablet !== undefined) {
        return tablet;
    }
    return mobile;
}

/**
 * Get responsive spacing
 * @param base - Base spacing value
 * @returns Scaled spacing
 */
export function responsiveSpacing(base: number): number {
    return responsive(
        base,
        base * 1.25, // 25% larger on tablet
        base * 1.5   // 50% larger on desktop
    );
}

/**
 * Get responsive padding for containers
 * @returns Responsive padding value
 */
export function getContainerPadding(): number {
    return responsive(12, 20, 24);
}

/**
 * Get number of columns for grid layout
 * @param minItemWidth - Minimum width for each item
 * @returns Number of columns
 */
export function getGridColumns(minItemWidth: number = 100): number {
    const padding = getContainerPadding();
    const availableWidth = SCREEN_WIDTH - (padding * 2);
    const columns = Math.floor(availableWidth / minItemWidth);
    return Math.max(2, Math.min(columns, 6)); // Between 2 and 6 columns
}

// Screen dimensions
export const Screen = {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    isSmall: SCREEN_WIDTH < 375,
    isMedium: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414,
    isLarge: SCREEN_WIDTH >= 414,
};
