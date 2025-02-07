export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'search' | 'number';
  value?: string | number;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  id?: string;
  required?: boolean;
} 