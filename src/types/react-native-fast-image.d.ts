declare module 'react-native-fast-image' {
  import { Component } from 'react';
  import { ImageStyle, ViewStyle } from 'react-native';

  interface FastImageProps {
    source: { uri: string } | number;
    style?: ImageStyle | ViewStyle;
    resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
    onLoad?: () => void;
    onError?: () => void;
    priority?: 'low' | 'normal' | 'high';
  }

  export default class FastImage extends Component<FastImageProps> {}
}
