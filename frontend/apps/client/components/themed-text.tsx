import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { scaleFontSize } from '@/constants/responsive';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'caption' | 'display';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'caption' ? styles.caption : undefined,
        type === 'display' ? styles.display : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: scaleFontSize(16),
    lineHeight: scaleFontSize(24),
    letterSpacing: 0,
  },
  defaultSemiBold: {
    fontSize: scaleFontSize(16),
    lineHeight: scaleFontSize(24),
    fontWeight: '600',
    letterSpacing: 0,
  },
  title: {
    fontSize: scaleFontSize(28),
    fontWeight: 'bold',
    lineHeight: scaleFontSize(34),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: scaleFontSize(20),
    fontWeight: '600',
    lineHeight: scaleFontSize(28),
    letterSpacing: -0.2,
  },
  link: {
    fontSize: scaleFontSize(16),
    lineHeight: scaleFontSize(24),
    color: 'hsl(217, 91%, 60%)',
    textDecorationLine: 'underline',
  },
  caption: {
    fontSize: scaleFontSize(12),
    lineHeight: scaleFontSize(16),
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  display: {
    fontSize: scaleFontSize(36),
    fontWeight: 'bold',
    lineHeight: scaleFontSize(42),
    letterSpacing: -1,
  },
});

