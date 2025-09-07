import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';

export default function ProfileScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-black">
      <Text weight="semibold" style={{ color: '#6b7280' }}>
        Profile Screen (Your pins and info)
      </Text>
    </View>
  );
}
