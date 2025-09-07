import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';

export default function ExploreScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-black">
      <Text weight="semibold" style={{ color: '#6b7280' }}>
        Explore Screen (Trending pins nearby)
      </Text>
    </View>
  );
}
