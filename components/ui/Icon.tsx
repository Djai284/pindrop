import React from 'react';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { TextStyle } from 'react-native';

export type IconProps = {
  name:
    | React.ComponentProps<typeof Feather>['name']
    | React.ComponentProps<typeof Ionicons>['name']
    | React.ComponentProps<typeof MaterialIcons>['name'];
  color?: string;
  size?: number;
  family?: 'Feather' | 'Ionicons' | 'MaterialIcons';
  style?: TextStyle;
};

export function Icon({ name, color, size = 24, family = 'Feather', style }: IconProps) {
  if (family === 'Ionicons') {
    return <Ionicons name={name as any} size={size} color={color} style={style} />;
  }
  if (family === 'MaterialIcons') {
    return <MaterialIcons name={name as any} size={size} color={color} style={style} />;
  }
  return <Feather name={name as any} size={size} color={color} style={style} />;
}

export default Icon;
