import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable, Share, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { usePinsStore } from '@/lib/store/pins';
import { useThemeStore } from '@/lib/store/theme';

export default function PinDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pin = usePinsStore((s) => s.getPin(id as string));
  const toggleLike = usePinsStore((s) => s.toggleLike);
  const { scheme } = useThemeStore();
  const router = useRouter();

  const tint = scheme === 'dark' ? '#60a5fa' : '#2563eb';

  const photos = useMemo(() => pin?.photos || [], [pin]);
  const { width: screenWidth } = useWindowDimensions();
  const [headerWidth, setHeaderWidth] = useState<number>(screenWidth);

  if (!pin) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black px-6">
        <Text weight="semibold" style={{ color: scheme === 'dark' ? '#d1d5db' : '#374151', textAlign: 'center' }}>
          Pin not found.
        </Text>
        <Pressable className="mt-4 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800" onPress={() => router.back()}>
          <Text weight="semibold" style={{ color: scheme === 'dark' ? '#e5e7eb' : '#111827' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black">
      {/* Header image carousel (simple) */}
      <View
        className="w-full h-64 bg-gray-100 dark:bg-gray-900"
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && Math.abs(w - headerWidth) > 1) setHeaderWidth(w);
        }}
      >
        {photos.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {photos.map((uri) => (
              <ExpoImage
                key={uri}
                source={{ uri }}
                style={{ width: headerWidth, height: 256 }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ))}
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="image" family="Feather" size={28} color={scheme === 'dark' ? '#6b7280' : '#9ca3af'} />
            <Text style={{ marginTop: 6, color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>No photos</Text>
          </View>
        )}
      </View>

      <View className="p-4">
        <Text weight="bold" style={{ fontSize: 20, color: scheme === 'dark' ? '#f3f4f6' : '#111827' }}>{pin.title || 'Untitled Pin'}</Text>
        {!!pin.description && (
          <Text style={{ marginTop: 6, color: scheme === 'dark' ? '#d1d5db' : '#374151' }}>{pin.description}</Text>
        )}
        <Text style={{ marginTop: 8, color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>
          {new Date(pin.createdAt).toLocaleString()} · {pin.privacy}
        </Text>

        {/* Actions */}
        <View className="flex-row items-center mt-4">
          <Pressable onPress={() => toggleLike(pin.id)} style={{ paddingVertical: 4, paddingRight: 12 }} accessibilityRole="button">
            <Icon
              name={pin.myLiked ? 'heart' : 'heart-outline'}
              family="Ionicons"
              size={26}
              color={pin.myLiked ? '#ef4444' : scheme === 'dark' ? '#9ca3af' : '#6b7280'}
            />
          </Pressable>
          <Text weight="semibold" style={{ color: scheme === 'dark' ? '#e5e7eb' : '#111827' }}>
            {pin.likesCount || 0} {(pin.likesCount || 0) === 1 ? 'like' : 'likes'}
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={async () => {
              try {
                await Share.share({ message: `${pin.title || 'Pin'}\nhttps://maps.google.com/?q=${pin.coords.latitude},${pin.coords.longitude}` });
              } catch {}
            }}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <Text weight="semibold" style={{ color: scheme === 'dark' ? '#e5e7eb' : '#111827' }}>Share</Text>
          </Pressable>
        </View>

        <Text style={{ marginTop: 10, color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>
          Lat: {pin.coords.latitude.toFixed(5)} · Lng: {pin.coords.longitude.toFixed(5)}
        </Text>
      </View>
    </ScrollView>
  );
}
