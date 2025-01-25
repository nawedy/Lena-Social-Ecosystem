import { useRef, useState, useEffect } from 'react';
import { Animated, _Platform } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import {
  withSpring,
  withTiming,
  withDelay,
  withDecay,
  _withSequence,
  _withRepeat,
} from 'react-native-reanimated';

interface AnimationConfig {
  duration?: number;
  useNativeDriver?: boolean;
  easing?: (value: number) => number;
}

interface SpringConfig extends AnimationConfig {
  damping?: number;
  mass?: number;
  stiffness?: number;
  overshootClamping?: boolean;
  restDisplacementThreshold?: number;
  restSpeedThreshold?: number;
}

class AnimationService {
  private static animatedValues = new Map<
    string,
    Animated.Value | Animated.ValueXY
  >();
  private static reanimatedValues = new Map<
    string,
    Reanimated.SharedValue<number>
  >();

  static createValue(key: string, initialValue = 0): Animated.Value {
    const value = new Animated.Value(initialValue);
    this.animatedValues.set(key, value);
    return value;
  }

  static createValueXY(
    key: string,
    initialX = 0,
    initialY = 0
  ): Animated.ValueXY {
    const value = new Animated.ValueXY({ x: initialX, y: initialY });
    this.animatedValues.set(key, value);
    return value;
  }

  static createReanimatedValue(
    key: string,
    initialValue = 0
  ): Reanimated.SharedValue<number> {
    const value = Reanimated.useSharedValue(initialValue);
    this.reanimatedValues.set(key, value);
    return value;
  }

  static fadeIn(
    value: Animated.Value,
    config: AnimationConfig = {}
  ): Animated.CompositeAnimation {
    return Animated.timing(value, {
      toValue: 1,
      duration: config.duration || 300,
      useNativeDriver: config.useNativeDriver ?? true,
      easing: config.easing,
    });
  }

  static fadeOut(
    value: Animated.Value,
    config: AnimationConfig = {}
  ): Animated.CompositeAnimation {
    return Animated.timing(value, {
      toValue: 0,
      duration: config.duration || 300,
      useNativeDriver: config.useNativeDriver ?? true,
      easing: config.easing,
    });
  }

  static timing(
    value: Animated.Value,
    toValue: number,
    config: AnimationConfig = {}
  ): Animated.CompositeAnimation {
    return Animated.timing(value, {
      toValue,
      duration: config.duration || 300,
      useNativeDriver: config.useNativeDriver ?? true,
      easing: config.easing,
    });
  }

  static spring(
    value: Animated.ValueXY,
    toX: number,
    toY: number,
    config: AnimationConfig = {}
  ): Animated.CompositeAnimation {
    return Animated.spring(value, {
      toValue: { x: toX, y: toY },
      useNativeDriver: config.useNativeDriver ?? true,
      ...config,
    });
  }

  static parallel(
    animations: Animated.CompositeAnimation[]
  ): Animated.CompositeAnimation {
    return Animated.parallel(animations);
  }

  static sequence(
    animations: Animated.CompositeAnimation[]
  ): Animated.CompositeAnimation {
    return Animated.sequence(animations);
  }

  static springReanimated(
    value: Reanimated.SharedValue<number>,
    toValue: number,
    config: SpringConfig = {}
  ): void {
    value.value = withSpring(toValue, {
      damping: config.damping || 10,
      mass: config.mass || 1,
      stiffness: config.stiffness || 100,
      overshootClamping: config.overshootClamping || false,
      restDisplacementThreshold: config.restDisplacementThreshold || 0.01,
      restSpeedThreshold: config.restSpeedThreshold || 2,
    });
  }

  static timingReanimated(
    value: Reanimated.SharedValue<number>,
    toValue: number,
    config: AnimationConfig = {}
  ): void {
    value.value = withTiming(toValue, {
      duration: config.duration || 300,
      easing: config.easing,
    });
  }

  static loop(
    _value: Animated.Value,
    animation: Animated.CompositeAnimation,
    numberOfTimes = -1
  ): Animated.CompositeAnimation {
    return Animated.loop(animation, { iterations: numberOfTimes });
  }

  static interpolate(
    value: Animated.Value,
    inputRange: number[],
    outputRange: number[] | string[]
  ): Animated.AnimatedInterpolation {
    return value.interpolate({
      inputRange,
      outputRange,
    });
  }

  static delay(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  static async delayAnimation(
    animation: Animated.CompositeAnimation,
    duration: number
  ): Promise<void> {
    await this.delay(duration);
    animation.start();
  }

  static keyframe(
    value: Animated.Value,
    keyframes: { [key: number]: number },
    config: AnimationConfig = {}
  ): Animated.CompositeAnimation {
    const animations = Object.entries(keyframes).map(([time, toValue]) =>
      Animated.timing(value, {
        toValue,
        duration: parseInt(time),
        useNativeDriver: config.useNativeDriver ?? true,
        easing: config.easing,
      })
    );
    return Animated.sequence(animations);
  }

  static springGroup(
    values: Animated.Value[],
    config: SpringConfig = {}
  ): Animated.CompositeAnimation {
    const animations = values.map(value =>
      Animated.spring(value, {
        toValue: 1,
        useNativeDriver: config.useNativeDriver ?? true,
        ...config,
      })
    );
    return Animated.parallel(animations);
  }

  static stagger(
    staggerTime: number,
    animations: Animated.CompositeAnimation[]
  ): Animated.CompositeAnimation {
    return Animated.stagger(staggerTime, animations);
  }

  static decay(
    value: Animated.Value,
    velocity: number,
    useNativeDriver = true
  ): Animated.CompositeAnimation {
    return Animated.decay(value, {
      velocity,
      useNativeDriver,
    });
  }

  static reset(
    value: Animated.Value,
    toValue: number,
    _config: AnimationConfig = {}
  ): void {
    value.setValue(toValue);
  }
}

export default AnimationService;
