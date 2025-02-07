export interface ModalProps {
  isOpen?: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
} 