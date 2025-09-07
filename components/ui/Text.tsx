import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';

export type TextProps = RNTextProps & {
  children?: React.ReactNode;
  className?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
};

const weightToFont: Record<NonNullable<TextProps['weight']>, string> = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export function Text({ children, weight = 'regular', style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[{ fontFamily: weightToFont[weight] } as any, style]}
    >
      {children}
    </RNText>
  );
}

export default Text;
