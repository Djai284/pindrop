import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { useThemeStore } from '@/lib/store/theme';
import { usePinsStore } from '@/lib/store/pins';
import { useProfileStore } from '@/lib/store/profile';
import { useSocialStore } from '@/lib/store/social';
import { resolveCity } from '@/lib/store/geocache';
import Colors from '@/constants/Colors';

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PublicProfileScreen() {
  const { username: param } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { scheme } = useThemeStore();

  const local = {
    displayName: useProfileStore((s) => s.displayName),
    username: useProfileStore((s) => s.username),
    bio: useProfileStore((s) => s.bio),
  };
  const users = useSocialStore((s) => s.users);
  const meUser = useSocialStore((s) => s.me().username);
  const isFollowing = useSocialStore((s) => s.isFollowing);
  const follow = useSocialStore((s) => s.follow);
  const unfollow = useSocialStore((s) => s.unfollow);
  const followerCount = useSocialStore((s) => s.followerCount);
  const followingCount = useSocialStore((s) => s.followingCount);

  const targetUsername = String(param || '').toLowerCase();
  const target = users.find((u) => u.username.toLowerCase() === targetUsername);
  const isSelf = targetUsername === (local.username || '').toLowerCase();

  const pins = usePinsStore((s) => s.pins);
  const visiblePins = useMemo(() => {
    return pins.filter((p) => {
      if (p.owner !== targetUsername) return false;
      if (isSelf) return true;
      if (p.privacy === 'public') return true;
      if (p.privacy === 'friends' && isFollowing(targetUsername)) return true;
      return false;
    });
  }, [pins, targetUsername, isSelf, isFollowing]);
  const publicPins = useMemo(() => visiblePins.filter((p) => p.privacy === 'public' || (p.privacy === 'friends' && !isSelf && isFollowing(targetUsername)) || isSelf), [visiblePins, isSelf, isFollowing, targetUsername]);

  const [citiesCount, setCitiesCount] = useState<number | null>(null);
  const [resolvingCities, setResolvingCities] = useState(false);

  const refreshCities = useCallback(async () => {
    if (!visiblePins.length) {
      setCitiesCount(0);
      return;
    }
    setResolvingCities(true);
    try {
      const unique = new Set<string>();
      const tasks = visiblePins.map((p) => resolveCity(p.coords.latitude, p.coords.longitude));
      const results = await Promise.all(tasks);
      for (const name of results) if (name) unique.add(name);
      setCitiesCount(unique.size);
    } catch {
      setCitiesCount(null);
    } finally {
      setResolvingCities(false);
    }
  }, [visiblePins]);

  useEffect(() => {
    refreshCities();
  }, [refreshCities]);

  if (!target) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black px-6">
        <Text weight="semibold" style={{ color: scheme === 'dark' ? '#d1d5db' : '#374151', textAlign: 'center' }}>
          User not found.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Card className="m-4">
        <View className="flex-row items-center">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: scheme === 'dark' ? '#1f2937' : '#111827' }}
          >
            <Text weight="bold" style={{ color: '#fff', fontSize: 18 }}>{initialsFromName(isSelf ? local.displayName : (target.displayName || target.username))}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="bold" style={{ fontSize: 18, color: scheme === 'dark' ? '#f3f4f6' : '#111827' }}>{isSelf ? local.displayName : (target.displayName || target.username)}</Text>
            <View className="flex-row items-center mt-1">
              <Icon name="at-sign" family="Feather" size={16} color={scheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <Text style={{ marginLeft: 6, color: scheme === 'dark' ? '#d1d5db' : '#374151' }}>@{isSelf ? local.username : target.username}</Text>
            </View>
          </View>
          {!isSelf && (
            <Pressable
              onPress={() => (isFollowing(targetUsername) ? unfollow(targetUsername) : follow(targetUsername))}
              className={isFollowing(targetUsername) ? 'px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800' : 'px-3 py-2 rounded-lg bg-primary-600'}
              accessibilityRole="button"
            >
              <Text weight="semibold" style={{ color: isFollowing(targetUsername) ? (scheme === 'dark' ? '#e5e7eb' : '#111827') : '#fff' }}>
                {isFollowing(targetUsername) ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          )}
        </View>

        {(isSelf ? !!local.bio : !!target.bio) && (
          <View className="mt-3">
            <Text style={{ color: scheme === 'dark' ? '#d1d5db' : '#374151' }}>{isSelf ? local.bio : target.bio}</Text>
          </View>
        )}

        <View className="flex-row mt-4">
          <View className="flex-1 items-center">
            <Text weight="bold" style={{ color: scheme === 'dark' ? '#f3f4f6' : '#111827', fontSize: 16 }}>{publicPins.length}</Text>
            <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>{isSelf ? 'My Pins' : isFollowing(targetUsername) ? 'Pins (Public+Friends)' : 'Public Pins'}</Text>
          </View>
          <View className="flex-1 items-center">
            <Pressable onPress={() => router.push(`/u/${targetUsername}/followers`)}>
              <Text weight="bold" style={{ color: scheme === 'dark' ? '#f3f4f6' : '#111827', fontSize: 16 }}>{followerCount(targetUsername)}</Text>
              <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Followers</Text>
            </Pressable>
          </View>
          <View className="flex-1 items-center">
            <Pressable onPress={() => router.push(`/u/${targetUsername}/following`)}>
              <Text weight="bold" style={{ color: scheme === 'dark' ? '#f3f4f6' : '#111827', fontSize: 16 }}>{isSelf ? followingCount() : 0}</Text>
              <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Following</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      <View className="px-4 pb-2">
        <Text weight="semibold" style={{ color: scheme === 'dark' ? '#e5e7eb' : '#111827', marginBottom: 8 }}>
          {isSelf ? 'My Pins' : isFollowing(targetUsername) ? 'Pins (Public + Friends)' : 'Public Pins'}
        </Text>
      </View>
      <FlatList
        data={publicPins}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        renderItem={({ item }) => {
          const uri = item.photos?.[0] || null;
          return (
            <Pressable
              onPress={() => router.push(`/pin/${item.id}`)}
              className="mb-3"
              style={{ width: '32%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: scheme === 'dark' ? '#111827' : '#f3f4f6' }}
            >
              {uri ? (
                <ExpoImage source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Icon name="map-pin" family="Feather" size={18} color={scheme === 'dark' ? '#6b7280' : '#9ca3af'} />
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={() => (
          <View className="px-4">
            <Card>
              <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>No public pins yet.</Text>
            </Card>
          </View>
        )}
      />
    </View>
  );
}
