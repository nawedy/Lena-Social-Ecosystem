import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Animated,
  Platform,
  TouchableOpacity,
} from 'react-native';
import FastImage, { FastImageProps, ImageStyle } from 'react-native-fast-image';
import { useTheme } from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import LottieView from 'lottie-react-native';

interface ImageProps extends Omit<FastImageProps, 'source'> {
  source: string | { uri: string };
  style?: ImageStyle;
  containerStyle?: ViewStyle;
  showLoadingIndicator?: boolean;
  showErrorRetry?: boolean;
  onRetry?: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  blurhash?: string;
  priority?: 'low' | 'normal' | 'high';
  loadingComponent?: React.ReactElement;
  errorComponent?: React.ReactElement;
}

export const Image: React.FC<ImageProps> = ({
  source,
  style,
  containerStyle,
  showLoadingIndicator = true,
  showErrorRetry = true,
  onRetry,
  onPress,
  onLongPress,
  blurhash,
  priority = 'normal',
  loadingComponent,
  errorComponent,
  ...props
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const opacity = new Animated.Value(0);

  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(false);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(false);
    onRetry?.();
  }, [onRetry]);

  const getPriority = () => {
    switch (priority) {
      case 'low':
        return FastImage.priority.low;
      case 'high':
        return FastImage.priority.high;
      default:
        return FastImage.priority.normal;
    }
  };

  const renderContent = () => {
    if (error) {
      if (errorComponent) {
        return errorComponent;
      }

      return (
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: theme.colors.card },
          ]}
        >
          {showErrorRetry ? (
            <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
              <Icon name="reload" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ) : (
            <Icon name="alert-circle" size={24} color={theme.colors.error} />
          )}
        </View>
      );
    }

    return (
      <View style={StyleSheet.absoluteFill}>
        {loading && showLoadingIndicator && (
          <View
            style={[
              styles.loadingContainer,
              { backgroundColor: theme.colors.card },
            ]}
          >
            {loadingComponent || (
              <LottieView
                source={require('../../assets/animations/image-loading.json')}
                autoPlay
                loop
                style={styles.loadingAnimation}
              />
            )}
          </View>
        )}
        <Animated.View style={{ opacity }}>
          <FastImage
            {...props}
            source={typeof source === 'string' ? { uri: source } : source}
            style={[styles.image, style]}
            onLoad={handleLoad}
            onError={handleError}
            priority={getPriority()}
          />
        </Animated.View>
      </View>
    );
  };

  const Container = onPress || onLongPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.container, containerStyle]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {blurhash && (
        <View style={StyleSheet.absoluteFill}>
          {/* Add blurhash component here if needed */}
        </View>
      )}
      {renderContent()}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAnimation: {
    width: 50,
    height: 50,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    padding: 8,
    borderRadius: 20,
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
