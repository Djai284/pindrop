import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { useThemeStore } from '@/lib/store/theme';
import { useSocialStore } from '@/lib/store/social';

export default function FollowingScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { scheme } = useThemeStore();
  const me = useSocialStore((s) => s.me().username);
  const myFollowing = useSocialStore((s) => s.following);
  const users = useSocialStore((s) => s.users);

  const target = String(username);
  const list = target === me
    ? myFollowing.map((u) => users.find((x) => x.username === u)).filter(Boolean) as { username: string; displayName: string }[]
    : [];

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <FlatList
        data={list}
        keyExtractor={(item) => item.username}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Card className="mb-3">
            <Pressable onPress={() => router.push(`/u/${item.username}`)} accessibilityRole="button">
              <Text weight="semibold" style={{ color: scheme === 'dark' ? '#e5e7eb' : '#111827' }}>{item.displayName}</Text>
              <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>@{item.username}</Text>
            </Pressable>
          </Card>
        )}
        ListEmptyComponent={() => (
          <View style={{ paddingHorizontal: 16 }}>
            <Card>
              <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                {target === me ? 'You are not following anyone yet.' : "Following list isn't available for other users in this demo."}
              </Text>
            </Card>
          </View>
        )}
      />
    </View>
  );
}
