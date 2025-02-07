export interface Tab {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  variant?: 'default' | 'pills' | 'underline';
} 