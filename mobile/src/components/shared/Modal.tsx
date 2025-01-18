import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal as RNModal,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: 'bottom' | 'center';
  animationType?: 'slide' | 'fade';
  style?: ViewStyle;
  avoidKeyboard?: boolean;
  closeOnBackdropPress?: boolean;
  backdropOpacity?: number;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  children,
  position = 'bottom',
  animationType = 'slide',
  style,
  avoidKeyboard = true,
  closeOnBackdropPress = true,
  backdropOpacity = 0.5,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (visible) {
      showModal();
    } else {
      hideModal();
    }
  }, [visible]);

  const showModal = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: backdropOpacity,
        duration: 300,
        useNativeDriver: true,
      }),
      animationType === 'slide'
        ? Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            mass: 1,
            stiffness: 100,
          })
        : Animated.parallel([
            Animated.spring(scale, {
              toValue: 1,
              useNativeDriver: true,
              damping: 20,
              mass: 1,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
    ]).start();
  };

  const hideModal = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      animationType === 'slide'
        ? Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 300,
            useNativeDriver: true,
          })
        : Animated.parallel([
            Animated.spring(scale, {
              toValue: 0.95,
              useNativeDriver: true,
              damping: 20,
              mass: 1,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
    ]).start(() => {
      onClose();
    });
  };

  const handleBackdropPress = () => {
    if (closeOnBackdropPress) {
      hideModal();
    }
  };

  const getModalStyle = () => {
    const baseStyle: ViewStyle = {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
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
    };

    if (position === 'bottom') {
      return {
        ...baseStyle,
        width: '100%',
        paddingBottom: insets.bottom + 16,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        transform: [{ translateY }],
      };
    }

    return {
      ...baseStyle,
      width: '90%',
      alignSelf: 'center',
      transform: [{ scale }],
    };
  };

  const Container = avoidKeyboard ? KeyboardAvoidingView : View;
  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;

  return (
    <RNModal
      transparent
      visible={visible}
      onRequestClose={hideModal}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                backgroundColor: theme.colors.backdrop,
                opacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Container
          behavior={keyboardBehavior}
          style={[
            styles.contentContainer,
            position === 'center' && styles.centerContent,
          ]}
        >
          <Animated.View style={[getModalStyle(), style]}>
            {children}
          </Animated.View>
        </Container>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  centerContent: {
    justifyContent: 'center',
  },
});
