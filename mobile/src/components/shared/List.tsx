import React, { useCallback, useRef } from 'react';
import {
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
  Animated,
  ViewStyle,
  ListRenderItem,
} from 'react-native';
import { useTheme } from '../../theme';
import LottieView from 'lottie-react-native';

interface ListProps<T> {
  data: T[];
  renderItem: ListRenderItem<T>;
  onRefresh?: () => Promise<void>;
  onLoadMore?: () => Promise<void>;
  loading?: boolean;
  refreshing?: boolean;
  hasMore?: boolean;
  ListEmptyComponent?: React.ReactElement;
  ListHeaderComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  itemSeparator?: boolean;
  itemSeparatorStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
  keyExtractor?: (item: T, index: number) => string;
}

export function List<T>({
  data,
  renderItem,
  onRefresh,
  onLoadMore,
  loading = false,
  refreshing = false,
  hasMore = false,
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
  style,
  itemSeparator = true,
  itemSeparatorStyle,
  showsVerticalScrollIndicator = false,
  keyExtractor,
}: ListProps<T>) {
  const theme = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const loadingMore = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore.current || !hasMore || !onLoadMore) return;

    loadingMore.current = true;
    await onLoadMore();
    loadingMore.current = false;
  }, [hasMore, onLoadMore]);

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }, [hasMore, theme]);

  const renderEmpty = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <LottieView
            source={require('../../assets/animations/loading.json')}
            autoPlay
            loop
            style={styles.loadingAnimation}
          />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading...
          </Text>
        </View>
      );
    }

    if (ListEmptyComponent) {
      return ListEmptyComponent;
    }

    return (
      <View style={styles.emptyContainer}>
        <LottieView
          source={require('../../assets/animations/empty.json')}
          autoPlay
          loop={false}
          style={styles.emptyAnimation}
        />
        <Text style={[styles.emptyText, { color: theme.colors.text }]}>
          No items found
        </Text>
      </View>
    );
  }, [loading, ListEmptyComponent, theme]);

  const renderSeparator = useCallback(() => {
    if (!itemSeparator) return null;

    return (
      <View
        style={[
          styles.separator,
          { backgroundColor: theme.colors.border },
          itemSeparatorStyle,
        ]}
      />
    );
  }, [itemSeparator, theme, itemSeparatorStyle]);

  const renderScrollIndicator = useCallback(() => {
    if (!showsVerticalScrollIndicator) return null;

    const opacity = scrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.scrollIndicator,
          {
            backgroundColor: theme.colors.primary,
            opacity,
          },
        ]}
      />
    );
  }, [showsVerticalScrollIndicator, scrollY, theme]);

  return (
    <View style={[styles.container, style]}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmpty()}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={
          <>
            {ListFooterComponent}
            {renderFooter()}
          </>
        }
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={[
          styles.contentContainer,
          !data.length && styles.emptyContentContainer,
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      />
      {renderScrollIndicator()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  emptyContentContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAnimation: {
    width: 150,
    height: 150,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyAnimation: {
    width: 200,
    height: 200,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  footer: {
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollIndicator: {
    position: 'absolute',
    right: 2,
    width: 3,
    height: 48,
    borderRadius: 3,
  },
});
