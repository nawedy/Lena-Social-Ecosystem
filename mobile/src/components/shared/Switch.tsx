import React, { useCallback, useEffect, useRef } from 'react';
import {
  _View,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  ViewStyle,
  AccessibilityProps,
  AccessibilityInfo,
  Platform,
} from 'react-native';

import { useTheme } from '../../theme';
import { hapticFeedback } from '../../utils/haptics';

interface SwitchProps extends AccessibilityProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
  trackColor?: {
    false: string;
    true: string;
  };
  thumbColor?: {
    false: string;
    true: string;
  };
  size?: 'small' | 'medium' | 'large';
}

export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  style,
  trackColor,
  thumbColor,
  size = 'medium',
  accessibilityLabel,
  accessibilityHint,
  ...accessibilityProps
}) => {
  const theme = useTheme();
  const translateX = useRef(new Animated.Value(value ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const getSwitchSize = useCallback(() => {
    switch (size) {
      case 'small':
        return {
          width: 40,
          height: 24,
          thumbSize: 20,
        };
      case 'large':
        return {
          width: 60,
          height: 36,
          thumbSize: 32,
        };
      default:
        return {
          width: 50,
          height: 30,
          thumbSize: 26,
        };
    }
  }, [size]);

  const { width, height, thumbSize } = getSwitchSize();

  const getTrackColor = useCallback(
    (isEnabled: boolean) => {
      if (disabled) {
        return theme.colors.disabled;
      }
      if (trackColor) {
        return isEnabled ? trackColor.true : trackColor.false;
      }
      return isEnabled ? theme.colors.primary : theme.colors.border;
    },
    [disabled, trackColor, theme]
  );

  const getThumbColor = useCallback(
    (isEnabled: boolean) => {
      if (disabled) {
        return theme.colors.placeholder;
      }
      if (thumbColor) {
        return isEnabled ? thumbColor.true : thumbColor.false;
      }
      return isEnabled ? theme.colors.background : theme.colors.card;
    },
    [disabled, thumbColor, theme]
  );

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: value ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      mass: 1,
      stiffness: 120,
    }).start();
  }, [value]);

  const handlePress = useCallback(() => {
    if (disabled) return;

    // Provide haptic feedback
    hapticFeedback('impactLight');

    // Animate thumb press
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onValueChange(!value);

    // Announce state change for screen readers
    AccessibilityInfo.announceForAccessibility(
      `${accessibilityLabel || 'Switch'} ${!value ? 'on' : 'off'}`
    );
  }, [value, disabled, onValueChange, accessibilityLabel]);

  const interpolatedBackgroundColor = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [getTrackColor(false), getTrackColor(true)],
  });

  const interpolatedThumbColor = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [getThumbColor(false), getThumbColor(true)],
  });

  const thumbTranslateX = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [2, width - thumbSize - 2],
  });

  return (
    <TouchableWithoutFeedback
      onPress={handlePress}
      accessibilityRole="switch"
      accessibilityState={{
        checked: value,
        disabled,
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      {...accessibilityProps}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: interpolatedBackgroundColor,
            width,
            height,
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              backgroundColor: interpolatedThumbColor,
              transform: [{ translateX: thumbTranslateX }, { scale }],
            },
          ]}
        />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  track: {
    borderRadius: 999,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
});
