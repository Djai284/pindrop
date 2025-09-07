import React from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import Icon from './Icon';

export type InputProps = TextInputProps & {
  leftIcon?: { name: any; color?: string; size?: number; family?: any };
  rightIcon?: { name: any; color?: string; size?: number; family?: any; onPress?: () => void };
  className?: string;
};

export const Input: React.FC<InputProps> = ({ leftIcon, rightIcon, className, style, ...rest }) => {
  return (
    <View className={['flex-row items-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3', className].filter(Boolean).join(' ')}>
      {leftIcon ? (
        <Icon
          name={leftIcon.name}
          color={leftIcon.color ?? '#6b7280'}
          size={leftIcon.size ?? 20}
          family={leftIcon.family ?? 'Feather'}
          style={{ marginRight: 8 }}
        />
      ) : null}
      <TextInput
        placeholderTextColor={rest.placeholderTextColor ?? '#9ca3af'}
        {...rest}
        style={[{ flex: 1, paddingVertical: 10 }, style]}
      />
      {rightIcon ? (
        <Pressable onPress={rightIcon.onPress} hitSlop={8}>
          <Icon
            name={rightIcon.name}
            color={rightIcon.color ?? '#6b7280'}
            size={rightIcon.size ?? 20}
            family={rightIcon.family ?? 'Feather'}
            style={{ marginLeft: 8 }}
          />
        </Pressable>
      ) : null}
    </View>
  );
};

export default Input;
