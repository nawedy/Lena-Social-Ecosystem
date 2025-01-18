declare module 'lottie-react-native' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  interface AnimationProps {
    source: object | string;
    style?: ViewStyle;
    loop?: boolean;
    autoPlay?: boolean;
    speed?: number;
    progress?: number;
    onAnimationFinish?: () => void;
  }

  export default class Animation extends Component<AnimationProps> {
    play(): void;
    reset(): void;
    pause(): void;
  }
}
