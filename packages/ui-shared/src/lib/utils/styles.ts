import { theme } from '../theme';

export function getColor(color: keyof typeof theme.colors, shade: keyof typeof theme.colors.primary = '500'): string {
  return theme.colors[color][shade];
}

export function getSpacing(size: keyof typeof theme.spacing): string {
  return theme.spacing[size];
}

export function getBorderRadius(size: keyof typeof theme.borderRadius): string {
  return theme.borderRadius[size];
}

export function getAnimation(name: keyof typeof theme.animation): string {
  return theme.animation[name];
}

export function getShadow(type: 'neon', variant: keyof typeof theme.shadows.neon): string {
  return theme.shadows[type][variant];
}

export function getTransition(speed: keyof typeof theme.transitions = 'DEFAULT'): string {
  return theme.transitions[speed];
}

export function getFont(family: keyof typeof theme.fonts): string {
  return theme.fonts[family].join(', ');
}

export function getBackground(type: keyof typeof theme.backgrounds): string {
  return theme.backgrounds[type];
}

export function createVariantClasses(variants: Record<string, string>, defaultVariant: string) {
  return (variant: keyof typeof variants = defaultVariant) => variants[variant];
}

export function createSizeClasses(sizes: Record<string, string>, defaultSize: string) {
  return (size: keyof typeof sizes = defaultSize) => sizes[size];
}

export function combineClasses(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
} 