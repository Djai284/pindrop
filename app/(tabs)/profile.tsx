import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Share, View } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/lib/store/theme';
import { usePinsStore } from '@/lib/store/pins';
import { useProfileStore } from '@/lib/store/profile';
import { resolveCity } from '@/lib/store/geocache';
import env from '@/lib/env';
import { useSocialStore } from '@/lib/store/social';
import Colors from '@/constants/Colors';

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { scheme } = useThemeStore();
  const pins = usePinsStore((s) => s.pins);
  const meUser = useSocialStore((s) => s.me().username);
  const followersMap = useSocialStore((s) => s.followers);
  const myFollowing = useSocialStore((s) => s.following);

  const displayName = useProfileStore((s) => s.displayName);
  const username = useProfileStore((s) => s.username);
  const bio = useProfileStore((s) => s.bio);

  // read-only on profile; editing happens in settings
  const [citiesCount, setCitiesCount] = useState<number | null>(null);
  const [resolvingCities, setResolvingCities] = useState(false);

  const myPins = useMemo(() => pins.filter((p: any) => p.owner === meUser || p.owner === 'me' || p.owner == null), [pins, meUser]);
  const totalPins = myPins.length;
  const recentPins = useMemo(() => [...myPins].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [myPins]);

  const refreshCities = useCallback(async () => {
    if (!pins.length) {
      setCitiesCount(0);
      return;
    }
    setResolvingCities(true);
    try {
      const unique = new Set<string>();
      // Resolve cities for each pin; dedupe by display string
      const tasks = myPins.map((p) => resolveCity(p.coords.latitude, p.coords.longitude));
      const results = await Promise.all(tasks);
      for (const name of results) {
        if (name) unique.add(name);
      }
      setCitiesCount(unique.size);
    } catch {
      setCitiesCount(null);
    } finally {
      setResolvingCities(false);
    }
  }, [myPins]);

  useEffect(() => {
    refreshCities();
  }, [refreshCities]);

  const shareProfile = useCallback(async () => {
    const link = `${env.APP_SCHEME || 'pindrop'}://u/${username}`;
    try {
      await Share.share({ message: `${displayName}\n${link}` });
    } catch {}
  }, [displayName, username]);

  // Header gear icon + theme toggle
  useLayoutEffect(() => {
    navigation.setOptions?.({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.push('/settings')} hitSlop={10} style={{ marginRight: 12 }}>
            <Icon name="settings" family="Feather" size={22} color={Colors[scheme ?? 'light'].text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, router, scheme]);

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {/* Header card */}
      <Card className="m-4">
        <View className="flex-row items-center">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: scheme === 'dark' ? '#1f2937' : '#111827' }}
          >
            <Text weight="bold" style={{ color: '#fff', fontSize: 18 }}>{initialsFromName(displayName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="bold" style={{ fontSize: 18, color: scheme === 'dark' ? '#f3f4f6' : '#111827' }}>{displayName}</Text>

            {/* Username row (non-edit by default but tap to edit) */}
            <View className="flex-row items-center mt-1">
              <Icon name="at-sign" family="Feather" size={16} color={scheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <Text style={{ marginLeft: 6, color: scheme === 'dark' ? '#d1d5db' : '#374151' }}>@{username}</Text>
            </View>
          </View>
        </View>

        {/* Bio */}
        <View className="mt-3">
          <Text style={{ color: scheme === 'dark' ? '#d1d5db' : '#374151' }}>
            {bio ? bio : 'Add a short bio from Settings'}
          </Text>
        </View>

        {/* Stats */}
        <View className="flex-row mt-4">
          <View className="flex-1 items-center">
            <Text weight="bold" style={{ color: scheme === 'dark' ? '#f3f4f6' : '#111827', fontSize: 16 }}>{totalPins}</Text>
            <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Total Pins</Text>
          </View>
          <View className="flex-1 items-center">
            <Pressable onPress={() => router.push(`/u/${username}/followers`)}>
              <Text weight="bold" style={{ color: scheme === 'dark' ? '#f3f4f6' : '#111827', fontSize: 16 }}>{(followersMap[username] || []).length}</Text>
              <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Followers</Text>
            </Pressable>
          </View>
          <View className="flex-1 items-center">
            <Pressable onPress={() => router.push(`/u/${username}/following`)}>
              <Text weight="bold" style={{ color: scheme === 'dark' ? '#f3f4f6' : '#111827', fontSize: 16 }}>{myFollowing.length}</Text>
              <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Following</Text>
            </Pressable>
          </View>
        </View>

        {/* Share profile */}
        <View className="mt-4">
          <Button label="Share Profile" onPress={shareProfile} variant="secondary" />
        </View>
      </Card>

      {/* Recent pins grid (all types, my own) */}
      <View className="px-4 pb-2">
        <Text weight="semibold" style={{ color: scheme === 'dark' ? '#e5e7eb' : '#111827', marginBottom: 8 }}>Recent Pins</Text>
      </View>
      <FlatList
        data={recentPins}
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
              <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>No pins yet.</Text>
            </Card>
          </View>
        )}
      />
    </View>
  );
}
