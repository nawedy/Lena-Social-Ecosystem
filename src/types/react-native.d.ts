declare module 'react-native' {
  import { ComponentType } from 'react';
  import { ViewStyle, TextStyle, ImageStyle } from 'react-native';

  export interface Platform {
    OS: 'ios' | 'android' | 'web';
    Version: number;
    select<T>(specifics: { ios?: T; android?: T; default?: T }): T;
    isPad: boolean;
    isTV: boolean;
    isTesting: boolean;
  }

  export const Platform: Platform;

  export interface AccessibilityState {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean | 'mixed';
    busy?: boolean;
    expanded?: boolean;
  }

  export type AccessibilityRole =
    | 'none'
    | 'button'
    | 'link'
    | 'search'
    | 'image'
    | 'keyboardkey'
    | 'text'
    | 'adjustable'
    | 'header'
    | 'summary'
    | 'imagebutton'
    | 'switch'
    | 'checkbox'
    | 'radio'
    | 'spinbutton'
    | 'menu'
    | 'menubar'
    | 'menuitem'
    | 'progressbar'
    | 'tab'
    | 'tablist'
    | 'timer'
    | 'toolbar'
    | 'form';

  export type AutoCapitalize = 'none' | 'sentences' | 'words' | 'characters';

  export type TextContentType =
    | 'none'
    | 'URL'
    | 'addressCity'
    | 'addressCityAndState'
    | 'addressState'
    | 'countryName'
    | 'creditCardNumber'
    | 'emailAddress'
    | 'familyName'
    | 'fullStreetAddress'
    | 'givenName'
    | 'jobTitle'
    | 'location'
    | 'middleName'
    | 'name'
    | 'namePrefix'
    | 'nameSuffix'
    | 'nickname'
    | 'organizationName'
    | 'postalCode'
    | 'streetAddressLine1'
    | 'streetAddressLine2'
    | 'sublocality'
    | 'telephoneNumber'
    | 'username'
    | 'password'
    | 'newPassword'
    | 'oneTimeCode';

  export interface ScaledSize {
    width: number;
    height: number;
    scale: number;
    fontScale: number;
  }

  export interface Dimensions {
    get(dimension: 'window' | 'screen'): ScaledSize;
    addEventListener(
      type: 'change',
      handler: (dims: { window: ScaledSize; screen: ScaledSize }) => void
    ): void;
    removeEventListener(
      type: 'change',
      handler: (dims: { window: ScaledSize; screen: ScaledSize }) => void
    ): void;
  }

  export const Dimensions: Dimensions;

  export interface ViewProps {
    style?: ViewStyle | ViewStyle[];
    accessibilityLabel?: string;
    accessibilityHint?: string;
    accessibilityRole?: AccessibilityRole;
    accessibilityState?: AccessibilityState;
    accessible?: boolean;
    testID?: string;
  }

  export interface TextProps {
    style?: TextStyle | TextStyle[];
    numberOfLines?: number;
    ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  }

  export interface TextInputProps {
    style?: TextStyle | TextStyle[];
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    placeholderTextColor?: string;
    secureTextEntry?: boolean;
    autoCapitalize?: AutoCapitalize;
    autoCorrect?: boolean;
    autoComplete?:
      | 'off'
      | 'username'
      | 'password'
      | 'email'
      | 'name'
      | 'tel'
      | 'street-address'
      | 'postal-code'
      | 'cc-number'
      | 'cc-csc'
      | 'cc-exp'
      | 'cc-exp-month'
      | 'cc-exp-year';
    textContentType?: TextContentType;
    keyboardType?:
      | 'default'
      | 'number-pad'
      | 'decimal-pad'
      | 'numeric'
      | 'email-address'
      | 'phone-pad'
      | 'url';
    returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
    onSubmitEditing?: () => void;
    multiline?: boolean;
    numberOfLines?: number;
    maxLength?: number;
    editable?: boolean;
  }

  export interface ImageProps {
    style?: ImageStyle | ImageStyle[];
    source: { uri: string } | number;
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    onLoad?: () => void;
    onError?: (error: { nativeEvent: { error: Error } }) => void;
  }

  export interface TouchableOpacityProps {
    style?: ViewStyle | ViewStyle[];
    onPress?: () => void;
    activeOpacity?: number;
    disabled?: boolean;
  }

  export interface ActivityIndicatorProps {
    size?: number | 'small' | 'large';
    color?: string;
    animating?: boolean;
  }

  export const View: ComponentType<ViewProps>;
  export const Text: ComponentType<TextProps>;
  export const TextInput: ComponentType<TextInputProps>;
  export const Image: ComponentType<ImageProps>;
  export const TouchableOpacity: ComponentType<TouchableOpacityProps>;
  export const ActivityIndicator: ComponentType<ActivityIndicatorProps>;
}
