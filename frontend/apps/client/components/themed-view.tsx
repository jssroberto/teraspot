import { View, type ViewProps, StyleSheet } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { BorderRadius, Shadows } from '@/constants/theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  glass?: boolean;
  elevation?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: keyof typeof BorderRadius;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  glass = false,
  elevation = 'none',
  rounded,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    glass ? 'glassBackground' : 'background'
  );

  const elevationStyle = elevation !== 'none' ? Shadows[elevation] : undefined;
  const borderRadiusStyle = rounded ? { borderRadius: BorderRadius[rounded] } : undefined;
  const glassStyle = glass
    ? {
      borderWidth: 1,
      borderColor: useThemeColor({}, 'glassBorder'),
    }
    : undefined;

  return (
    <View
      style={[
        { backgroundColor },
        elevationStyle,
        borderRadiusStyle,
        glassStyle,
        style,
      ]}
      {...otherProps}
    />
  );
}

