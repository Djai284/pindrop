import React from 'react';
import { View, ViewProps } from 'react-native';

export type CardProps = ViewProps & {
  children?: React.ReactNode;
  className?: string;
};

export const Card: React.FC<CardProps> = ({ children, className, ...rest }) => {
  return (
    <View
      {...rest}
      className={[
        'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm',
        'p-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </View>
  );
};

export default Card;
