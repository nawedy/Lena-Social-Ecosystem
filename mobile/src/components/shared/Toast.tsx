import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  AccessibilityInfo,
  Platform,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
  position?: 'top' | 'bottom';
  showProgress?: boolean;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
  action,
  position = 'bottom',
  showProgress = true,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const timeout = useRef<NodeJS.Timeout>();

  const getIconName = useCallback(() => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      default:
        return 'information-circle';
    }
  }, [type]);

  const getBackgroundColor = useCallback(() => {
    switch (type) {
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.info;
    }
  }, [type, theme]);

  const show = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        mass: 1,
        stiffness: 100,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    if (showProgress) {
      Animated.timing(progress, {
        toValue: 1,
        duration,
        useNativeDriver: false,
      }).start();
    }

    // Announce message for screen readers
    AccessibilityInfo.announceForAccessibility(`${type}: ${message}`);
  }, [translateY, opacity, progress, duration, showProgress, type, message]);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  }, [translateY, opacity, position, onDismiss]);

  useEffect(() => {
    if (visible) {
      show();
      if (duration > 0) {
        timeout.current = setTimeout(hide, duration);
      }
    } else {
      hide();
    }

    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, [visible, duration, show, hide]);

  const handlePress = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    hide();
  }, [hide]);

  const handleActionPress = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    action?.onPress();
    hide();
  }, [action, hide]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          transform: [{ translateY }],
          opacity,
          top: position === 'top' ? insets.top + 16 : undefined,
          bottom: position === 'bottom' ? insets.bottom + 16 : undefined,
        },
      ]}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <TouchableOpacity
        onPress={handlePress}
        style={styles.content}
        activeOpacity={0.8}
      >
        <Icon
          name={getIconName()}
          size={24}
          color="white"
          style={styles.icon}
        />
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        {action && (
          <TouchableOpacity
            onPress={handleActionPress}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {showProgress && (
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: SCREEN_WIDTH - 32,
    minHeight: 48,
    borderRadius: 8,
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  action: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});
