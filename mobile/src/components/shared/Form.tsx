import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
} from 'react-native';

import { useTheme } from '../../theme';

import { Input } from './Input';

interface FormField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'phone' | 'number';
  required?: boolean;
  validation?: (value: string) => string | undefined;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  placeholder?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  autoComplete?: string;
  maxLength?: number;
}

interface FormProps {
  fields: FormField[];
  onSubmit: (values: Record<string, string>) => void;
  style?: ViewStyle;
  initialValues?: Record<string, string>;
  submitOnEnter?: boolean;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  scrollEnabled?: boolean;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}

export const Form: React.FC<FormProps> = ({
  fields,
  onSubmit,
  style,
  initialValues = {},
  submitOnEnter = true,
  validateOnChange = false,
  validateOnBlur = true,
  scrollEnabled = true,
  keyboardShouldPersistTaps = 'handled',
}) => {
  const theme = useTheme();
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const inputRefs = useRef<Record<string, any>>({});

  const validateField = useCallback(
    (name: string, value: string) => {
      const field = fields.find(f => f.name === name);
      if (!field) return undefined;

      if (field.required && !value) {
        return `${field.label} is required`;
      }

      if (field.validation) {
        return field.validation(value);
      }

      if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Invalid email address';
        }
      }

      if (field.type === 'phone' && value) {
        const phoneRegex = /^\+?[\d\s-]{10,}$/;
        if (!phoneRegex.test(value)) {
          return 'Invalid phone number';
        }
      }

      return undefined;
    },
    [fields]
  );

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    fields.forEach(field => {
      const error = validateField(field.name, values[field.name] || '');
      if (error) {
        newErrors[field.name] = error;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields, values, validateField]);

  const handleChange = useCallback(
    (name: string, value: string) => {
      setValues(prev => ({ ...prev, [name]: value }));
      if (validateOnChange) {
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error || '' }));
      }
    },
    [validateOnChange, validateField]
  );

  const handleBlur = useCallback(
    (name: string) => {
      setTouched(prev => ({ ...prev, [name]: true }));
      if (validateOnBlur) {
        const error = validateField(name, values[name] || '');
        setErrors(prev => ({ ...prev, [name]: error || '' }));
      }
    },
    [validateOnBlur, validateField, values]
  );

  const handleSubmit = useCallback(() => {
    const allTouched: Record<string, boolean> = {};
    fields.forEach(field => {
      allTouched[field.name] = true;
    });
    setTouched(allTouched);

    if (validateForm()) {
      Keyboard.dismiss();
      onSubmit(values);
    } else {
      // Announce first error to screen reader
      const firstError = Object.values(errors)[0];
      if (firstError) {
        AccessibilityInfo.announceForAccessibility(firstError);
      }

      // Focus first field with error
      const firstErrorField = fields.find(field => errors[field.name]);
      if (firstErrorField) {
        inputRefs.current[firstErrorField.name]?.focus();
      }
    }
  }, [fields, validateForm, values, onSubmit, errors]);

  const handleKeyPress = useCallback(
    (e: any, index: number) => {
      if (
        submitOnEnter &&
        e.nativeEvent.key === 'Enter' &&
        index === fields.length - 1
      ) {
        handleSubmit();
      } else if (e.nativeEvent.key === 'Enter' && index < fields.length - 1) {
        const nextField = fields[index + 1];
        inputRefs.current[nextField.name]?.focus();
      }
    },
    [fields, submitOnEnter, handleSubmit]
  );

  const Container = scrollEnabled ? ScrollView : View;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoidingView}
    >
      <Container
        style={[styles.container, style]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        accessible={true}
        accessibilityRole="form"
      >
        {fields.map((field, index) => (
          <Input
            key={field.name}
            ref={ref => (inputRefs.current[field.name] = ref)}
            label={field.label}
            value={values[field.name] || ''}
            onChangeText={value => handleChange(field.name, value)}
            onBlur={() => handleBlur(field.name)}
            error={touched[field.name] ? errors[field.name] : undefined}
            touched={touched[field.name]}
            required={field.required}
            autoCapitalize={field.autoCapitalize}
            secureTextEntry={field.secureTextEntry}
            keyboardType={field.keyboardType}
            placeholder={field.placeholder}
            leftIcon={field.leftIcon}
            rightIcon={field.rightIcon}
            onRightIconPress={field.onRightIconPress}
            autoComplete={field.autoComplete}
            maxLength={field.maxLength}
            returnKeyType={index === fields.length - 1 ? 'done' : 'next'}
            onSubmitEditing={() => {
              if (index < fields.length - 1) {
                inputRefs.current[fields[index + 1].name]?.focus();
              } else if (submitOnEnter) {
                handleSubmit();
              }
            }}
            onKeyPress={e => handleKeyPress(e, index)}
            accessibilityLabel={field.label}
            accessibilityHint={field.required ? 'Required field' : undefined}
            accessibilityState={{
              required: field.required,
              error: !!errors[field.name] && touched[field.name],
            }}
          />
        ))}
      </Container>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
});
