/**
 * Animated status badge component with gradient backgrounds
 * Shows parking space status with smooth animations
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { ThemedText } from './themed-text';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type StatusBadgeProps = {
    status: 'vacant' | 'occupied' | 'unknown';
    label: string;
    size?: 'small' | 'medium' | 'large';
    animated?: boolean;
};

export function StatusBadge({
    status,
    label,
    size = 'medium',
    animated = true,
}: StatusBadgeProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const scale = useSharedValue(1);

    // Pulse animation for status changes
    useEffect(() => {
        if (animated && status !== 'unknown') {
            scale.value = withSequence(
                withTiming(1.1, { duration: 200, easing: Easing.out(Easing.ease) }),
                withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) })
            );
        }
    }, [status, animated]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const getBackgroundColor = () => {
        switch (status) {
            case 'vacant':
                return colors.success;
            case 'occupied':
                return colors.error;
            default:
                return colors.textSecondary;
        }
    };

    const getSizeStyles = () => {
        switch (size) {
            case 'small':
                return {
                    paddingHorizontal: Spacing.sm,
                    paddingVertical: Spacing.xs,
                    fontSize: 10,
                };
            case 'large':
                return {
                    paddingHorizontal: Spacing.xl,
                    paddingVertical: Spacing.md,
                    fontSize: 16,
                };
            default:
                return {
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm,
                    fontSize: 12,
                };
        }
    };

    const sizeStyles = getSizeStyles();

    return (
        <Animated.View style={[animatedStyle]}>
            <View
                style={[
                    styles.badge,
                    {
                        backgroundColor: getBackgroundColor(),
                        paddingHorizontal: sizeStyles.paddingHorizontal,
                        paddingVertical: sizeStyles.paddingVertical,
                    },
                    Shadows.sm,
                ]}
            >
                <ThemedText
                    style={[
                        styles.label,
                        {
                            fontSize: sizeStyles.fontSize,
                            color: '#ffffff',
                        },
                    ]}
                >
                    {label}
                </ThemedText>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    badge: {
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
