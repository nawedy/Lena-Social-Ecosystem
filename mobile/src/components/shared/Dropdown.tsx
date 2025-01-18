import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import { useTheme } from '../../theme';


const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DropdownItem {
  label: string;
  value: string;
  icon?: string;
  disabled?: boolean;
}

interface DropdownProps {
  label?: string;
  value?: string;
  items: DropdownItem[];
  placeholder?: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  itemStyle?: ViewStyle;
  dropdownStyle?: ViewStyle;
  searchable?: boolean;
  multiple?: boolean;
  required?: boolean;
  loading?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  value,
  items,
  placeholder = 'Select an option',
  onChange,
  error,
  disabled = false,
  style,
  containerStyle,
  labelStyle,
  itemStyle,
  dropdownStyle,
  searchable = false,
  multiple = false,
  required = false,
  loading = false,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>(
    value ? [value] : []
  );
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const filteredItems = items.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSelectedLabel = () => {
    if (multiple) {
      const selected = items.filter(item => selectedItems.includes(item.value));
      return selected.length
        ? selected.map(item => item.label).join(', ')
        : placeholder;
    }
    const selected = items.find(item => item.value === value);
    return selected ? selected.label : placeholder;
  };

  const handleOpen = useCallback(() => {
    if (disabled || loading) return;

    setIsOpen(true);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        mass: 1,
        stiffness: 100,
      }),
      Animated.timing(opacity, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [disabled, loading]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsOpen(false);
      setSearchQuery('');
    });
  }, []);

  const handleSelect = useCallback(
    (selectedValue: string) => {
      if (multiple) {
        const newSelectedItems = selectedItems.includes(selectedValue)
          ? selectedItems.filter(item => item !== selectedValue)
          : [...selectedItems, selectedValue];
        setSelectedItems(newSelectedItems);
        onChange(newSelectedItems.join(','));
      } else {
        onChange(selectedValue);
        handleClose();
      }
    },
    [multiple, selectedItems, onChange]
  );

  const renderItem = ({ item }: { item: DropdownItem }) => {
    const isSelected = multiple
      ? selectedItems.includes(item.value)
      : item.value === value;

    return (
      <TouchableOpacity
        style={[
          styles.item,
          isSelected && {
            backgroundColor: theme.colors.primary + '20',
          },
          item.disabled && styles.disabledItem,
          itemStyle,
        ]}
        onPress={() => !item.disabled && handleSelect(item.value)}
        disabled={item.disabled}
        accessibilityRole="menuitem"
        accessibilityState={{
          selected: isSelected,
          disabled: item.disabled,
        }}
        accessibilityLabel={`${item.label}${item.disabled ? ', disabled' : ''}`}
      >
        <View style={styles.itemContent}>
          {item.icon && (
            <Icon
              name={item.icon}
              size={20}
              color={
                isSelected
                  ? theme.colors.primary
                  : item.disabled
                    ? theme.colors.disabled
                    : theme.colors.text
              }
              style={styles.itemIcon}
            />
          )}
          <Text
            style={[
              styles.itemLabel,
              {
                color: isSelected
                  ? theme.colors.primary
                  : item.disabled
                    ? theme.colors.disabled
                    : theme.colors.text,
              },
            ]}
          >
            {item.label}
          </Text>
          {isSelected && (
            <Icon
              name="checkmark"
              size={20}
              color={theme.colors.primary}
              style={styles.checkIcon}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: error ? theme.colors.error : theme.colors.text },
            labelStyle,
          ]}
        >
          {label}
          {required && <Text style={{ color: theme.colors.error }}> *</Text>}
        </Text>
      )}
      <TouchableOpacity
        style={[
          styles.button,
          {
            borderColor: error
              ? theme.colors.error
              : isOpen
                ? theme.colors.primary
                : theme.colors.border,
            backgroundColor: disabled
              ? theme.colors.disabled
              : theme.colors.card,
          },
          style,
        ]}
        onPress={handleOpen}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{
          expanded: isOpen,
          disabled: disabled || loading,
        }}
        accessibilityLabel={`${label || 'Dropdown'}, ${getSelectedLabel()}`}
      >
        <Text
          style={[
            styles.selectedLabel,
            {
              color:
                value || selectedItems.length
                  ? theme.colors.text
                  : theme.colors.placeholder,
            },
          ]}
          numberOfLines={1}
        >
          {getSelectedLabel()}
        </Text>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={styles.icon}
          />
        ) : (
          <Icon
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={disabled ? theme.colors.disabled : theme.colors.text}
            style={styles.icon}
          />
        )}
      </TouchableOpacity>
      {error && (
        <Text style={[styles.error, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}

      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            activeOpacity={1}
          >
            <Animated.View
              style={[
                styles.backdrop,
                {
                  opacity,
                  backgroundColor: theme.colors.backdrop,
                },
              ]}
            />
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.dropdown,
              {
                backgroundColor: theme.colors.card,
                transform: [{ translateY }],
                maxHeight: SCREEN_HEIGHT * 0.7,
                paddingBottom: insets.bottom,
              },
              dropdownStyle,
            ]}
          >
            {searchable && (
              <View style={styles.searchContainer}>
                <Icon
                  name="search"
                  size={20}
                  color={theme.colors.placeholder}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search..."
                  placeholderTextColor={theme.colors.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            <FlatList
              data={filteredItems}
              renderItem={renderItem}
              keyExtractor={item => item.value}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text
                  style={[
                    styles.emptyText,
                    { color: theme.colors.placeholder },
                  ]}
                >
                  No options available
                </Text>
              }
            />

            {multiple && (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.footerButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={handleClose}
                >
                  <Text style={styles.footerButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  selectedLabel: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
  },
  icon: {
    marginLeft: 8,
  },
  error: {
    marginTop: 4,
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  dropdown: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  item: {
    padding: 16,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    marginRight: 12,
  },
  itemLabel: {
    flex: 1,
    fontSize: 16,
  },
  checkIcon: {
    marginLeft: 12,
  },
  disabledItem: {
    opacity: 0.5,
  },
  emptyText: {
    padding: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  footerButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
