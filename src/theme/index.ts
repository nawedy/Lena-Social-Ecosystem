import { useContext } from 'react';
import { createContext } from 'react';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  error: string;
  text: string;
  onPrimary: string;
  onSecondary: string;
  onBackground: string;
  onSurface: string;
  onError: string;
  border: string;
  placeholder: string;
  disabled: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ThemeTypography {
  h1: {
    fontSize: number;
    fontWeight: string;
    lineHeight: number;
  };
  h2: {
    fontSize: number;
    fontWeight: string;
    lineHeight: number;
  };
  h3: {
    fontSize: number;
    fontWeight: string;
    lineHeight: number;
  };
  body1: {
    fontSize: number;
    fontWeight: string;
    lineHeight: number;
  };
  body2: {
    fontSize: number;
    fontWeight: string;
    lineHeight: number;
  };
  button: {
    fontSize: number;
    fontWeight: string;
    lineHeight: number;
    textTransform?: string;
  };
  caption: {
    fontSize: number;
    fontWeight: string;
    lineHeight: number;
  };
}

export interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

export const defaultTheme: Theme = {
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    error: '#FF3B30',
    text: '#000000',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onBackground: '#000000',
    onSurface: '#000000',
    onError: '#FFFFFF',
    border: '#C6C6C8',
    placeholder: '#8E8E93',
    disabled: '#C7C7CC',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    h1: {
      fontSize: 34,
      fontWeight: '700',
      lineHeight: 41,
    },
    h2: {
      fontSize: 28,
      fontWeight: '700',
      lineHeight: 34,
    },
    h3: {
      fontSize: 22,
      fontWeight: '600',
      lineHeight: 28,
    },
    body1: {
      fontSize: 17,
      fontWeight: '400',
      lineHeight: 22,
    },
    body2: {
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 20,
    },
    button: {
      fontSize: 17,
      fontWeight: '600',
      lineHeight: 22,
      textTransform: 'none',
    },
    caption: {
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
    },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
  shadows: {
    sm: '0px 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0px 2px 6px rgba(0, 0, 0, 0.15)',
    lg: '0px 4px 12px rgba(0, 0, 0, 0.2)',
  },
};

const ThemeContext = createContext<Theme>(defaultTheme);

export const useTheme = () => useContext(ThemeContext);

export const theme = defaultTheme;
