declare module '../theme' {
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

  export const theme: Theme;
  export const useTheme: () => Theme;
}
