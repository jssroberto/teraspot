/**
 * Reusable animated card component with entrance animations
 * Supports glassmorphism, shadows, and press interactions
 */

import React, { useEffect } from 'react';
import { StyleSheet, Pressable, ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type AnimatedCardProps = {
    children: React.ReactNode;
    onPress?: () => void;
    delay?: number;
    glass?: boolean;
    style?: ViewStyle;
};

export function AnimatedCard({
    children,
    onPress,
    delay = 0,
    glass = false,
    style,
}: AnimatedCardProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);
    const scale = useSharedValue(1);

    // Entrance animation
    useEffect(() => {
        const animationConfig = {
            duration: 300,
            easing: Easing.out(Easing.ease),
        };

        if (delay > 0) {
            const timer = setTimeout(() => {
                opacity.value = withTiming(1, animationConfig);
                translateY.value = withTiming(0, animationConfig);
            }, delay);
            return () => clearTimeout(timer);
        } else {
            opacity.value = withTiming(1, animationConfig);
            translateY.value = withTiming(0, animationConfig);
        }
    }, [delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.95, {
            damping: 15,
            stiffness: 150,
        });
        if (onPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, {
            damping: 15,
            stiffness: 150,
        });
    };

    const cardStyle = glass
        ? {
            backgroundColor: colors.glassBackground,
            borderColor: colors.glassBorder,
            borderWidth: 1,
        }
        : {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
            borderWidth: 1,
        };

    const content = (
        <Animated.View
            style={[
                styles.card,
                cardStyle,
                Shadows.md,
                animatedStyle,
                style,
            ]}
        >
            {children}
        </Animated.View>
    );

    if (onPress) {
        return (
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
            >
                {content}
            </Pressable>
        );
    }

    return content;
}

const styles = StyleSheet.create({
    card: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        overflow: 'hidden',
    },
});
