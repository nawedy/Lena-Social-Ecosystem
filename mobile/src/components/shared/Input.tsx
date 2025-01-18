import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
  AccessibilityProps,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import { useTheme } from '../../theme';

interface InputProps extends TextInputProps, AccessibilityProps {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  labelStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  required?: boolean;
  loading?: boolean;
  success?: boolean;
  touched?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  labelStyle,
  inputStyle,
  required = false,
  loading = false,
  success = false,
  touched = false,
  onBlur,
  onFocus,
  accessibilityLabel,
  accessibilityHint,
  ...props
}) => {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const animatedLabelPosition = useRef(
    new Animated.Value(props.value ? 1 : 0)
  ).current;
  const animatedBorderWidth = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
    Animated.parallel([
      Animated.timing(animatedBorderWidth, {
        toValue: 2,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(animatedLabelPosition, {
        toValue: -20,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [animatedBorderWidth, animatedLabelPosition, onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
    if (!props.value) {
      Animated.parallel([
        Animated.timing(animatedBorderWidth, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(animatedLabelPosition, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [animatedBorderWidth, animatedLabelPosition, onBlur, props.value]);

  const shakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shake, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shake]);

  React.useEffect(() => {
    if (error && touched) {
      shakeAnimation();
    }
  }, [error, shakeAnimation, touched]);

  const getBorderColor = () => {
    if (error && touched) return theme.colors.error;
    if (success) return theme.colors.success;
    if (isFocused) return theme.colors.primary;
    return theme.colors.border;
  };

  const labelTranslateY = animatedLabelPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -25],
  });

  const labelScale = animatedLabelPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });

  const borderWidth = animatedBorderWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        { transform: [{ translateX: shake }] },
      ]}
      accessible={true}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityRole="none"
      accessibilityState={{
        disabled: props.editable === false,
        error: !!error && touched,
      }}
    >
      {label && (
        <Animated.Text
          style={[
            styles.label,
            labelStyle,
            {
              color: error && touched ? theme.colors.error : theme.colors.text,
              transform: [
                { translateY: labelTranslateY },
                { scale: labelScale },
              ],
            },
          ]}
        >
          {label}
          {required && <Text style={{ color: theme.colors.error }}> *</Text>}
        </Animated.Text>
      )}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            borderColor: getBorderColor(),
            borderWidth,
            backgroundColor:
              props.editable === false
                ? theme.colors.disabled
                : theme.colors.card,
          },
        ]}
      >
        {leftIcon && (
          <Icon
            name={leftIcon}
            size={20}
            color={
              error && touched
                ? theme.colors.error
                : success
                  ? theme.colors.success
                  : theme.colors.text
            }
            style={styles.leftIcon}
          />
        )}
        <TextInput
          {...props}
          style={[
            styles.input,
            inputStyle,
            {
              color: theme.colors.text,
              paddingLeft: leftIcon ? 40 : 16,
              paddingRight: rightIcon ? 40 : 16,
            },
          ]}
          placeholderTextColor={theme.colors.placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityRole="text"
          accessibilityState={{
            disabled: props.editable === false,
            error: !!error && touched,
          }}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            accessibilityRole="button"
            accessibilityLabel={`${rightIcon} button`}
          >
            <Icon
              name={rightIcon}
              size={20}
              color={
                error && touched
                  ? theme.colors.error
                  : success
                    ? theme.colors.success
                    : theme.colors.text
              }
            />
          </TouchableOpacity>
        )}
        {loading && (
          <View style={styles.rightIcon}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}
      </Animated.View>
      {(error || helper) && touched && (
        <Text
          style={[
            styles.helper,
            {
              color: error ? theme.colors.error : theme.colors.text,
            },
          ]}
          accessibilityRole="alert"
          accessible={!!error}
        >
          {error || helper}
        </Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  input: {
    height: 48,
    fontSize: 16,
  },
  leftIcon: {
    position: 'absolute',
    left: 12,
    top: 14,
  },
  rightIcon: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  helper: {
    marginTop: 4,
    fontSize: 12,
  },
});
