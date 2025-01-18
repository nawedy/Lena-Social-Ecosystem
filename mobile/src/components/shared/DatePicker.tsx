import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Platform,
  ViewStyle,
  TextStyle,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import { useTheme } from '../../theme';


const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DatePickerProps {
  label?: string;
  value?: Date;
  onChange: (date: Date) => void;
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  placeholder?: string;
  format?: string;
  mode?: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  required?: boolean;
  minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
  is24Hour?: boolean;
  locale?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  error,
  disabled = false,
  style,
  containerStyle,
  labelStyle,
  placeholder = 'Select date',
  format = 'MMMM D, YYYY',
  mode = 'date',
  minimumDate,
  maximumDate,
  required = false,
  minuteInterval = 1,
  is24Hour = false,
  locale = 'en',
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [tempDate, setTempDate] = useState(value || new Date());
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const handleOpen = useCallback(() => {
    if (disabled) return;

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
  }, [disabled]);

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
    });
  }, []);

  const handleChange = useCallback(
    (event: any, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setIsOpen(false);
      }

      if (selectedDate) {
        setTempDate(selectedDate);
        if (Platform.OS === 'android') {
          onChange(selectedDate);
        }
      }
    },
    [onChange]
  );

  const handleDone = useCallback(() => {
    onChange(tempDate);
    handleClose();
  }, [tempDate, onChange]);

  const formatDate = useCallback(
    (date?: Date) => {
      if (!date) return placeholder;
      return dayjs(date).format(format);
    },
    [format, placeholder]
  );

  const renderIOSPicker = () => (
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
            styles.pickerContainer,
            {
              backgroundColor: theme.colors.card,
              transform: [{ translateY }],
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
              <Text
                style={[
                  styles.headerButtonText,
                  { color: theme.colors.primary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDone} style={styles.headerButton}>
              <Text
                style={[
                  styles.headerButtonText,
                  { color: theme.colors.primary },
                ]}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={tempDate}
            mode={mode}
            display="spinner"
            onChange={handleChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            minuteInterval={minuteInterval}
            locale={locale}
            is24Hour={is24Hour}
            style={styles.picker}
            textColor={theme.colors.text}
          />
        </Animated.View>
      </View>
    </Modal>
  );

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
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{
          disabled,
        }}
        accessibilityLabel={`${label || 'Date Picker'}, ${formatDate(value)}`}
      >
        <Text
          style={[
            styles.value,
            {
              color: value ? theme.colors.text : theme.colors.placeholder,
            },
          ]}
        >
          {formatDate(value)}
        </Text>
        <Icon
          name="calendar"
          size={20}
          color={disabled ? theme.colors.disabled : theme.colors.text}
          style={styles.icon}
        />
      </TouchableOpacity>
      {error && (
        <Text style={[styles.error, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}

      {Platform.OS === 'ios'
        ? renderIOSPicker()
        : isOpen && (
            <DateTimePicker
              value={tempDate}
              mode={mode}
              display="default"
              onChange={handleChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              minuteInterval={minuteInterval}
              is24Hour={is24Hour}
            />
          )}
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
  value: {
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
  pickerContainer: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  picker: {
    height: 216,
  },
});
