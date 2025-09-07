import React from 'react';
import { Pressable, PressableProps, Text } from 'react-native';

export type ButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export const Button: React.FC<ButtonProps> = ({ label, variant = 'primary', className, ...rest }: any) => {
  const base = 'px-4 py-3 rounded-lg items-center justify-center';
  const variants: Record<string, string> = {
    primary: 'bg-primary-600 active:bg-primary-700',
    secondary: 'bg-gray-100 dark:bg-gray-800',
    ghost: 'bg-transparent',
  };
  const textColor: Record<string, string> = {
    primary: 'text-white',
    secondary: 'text-gray-900 dark:text-gray-100',
    ghost: 'text-primary-600',
  };
  return (
    <Pressable {...rest} className={[base, variants[variant], className].filter(Boolean).join(' ')}>
      <Text className={['text-base font-semibold', textColor[variant]].join(' ')}>{label}</Text>
    </Pressable>
  );
};

export default Button;
