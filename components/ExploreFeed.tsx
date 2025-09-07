import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, Share, StyleSheet, View, TextInput } from 'react-native';
import * as Location from 'expo-location';
import { FlashList } from '@shopify/flash-list';
import { useWindowDimensions } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import Card from '@/components/ui/Card';
import Colors from '@/constants/Colors';
import { useThemeStore } from '@/lib/store/theme';
import { usePinsStore } from '@/lib/store/pins';
import type { Pin } from '@/lib/types/pin';
import { useSocialStore } from '@/lib/store/social';
import { useMapUiStore } from '@/lib/store/map';
import { useNavigation } from 'expo-router';
import ImageGallery from '@/components/ui/ImageGallery';
import MiniSlider from '@/components/ui/MiniSlider';
import CommentsSheet, { CommentsSheetRef } from '@/components/comments/CommentsSheet';

function toRad(v: number) {
  return (v * Math.PI) / 180;
}
function haversineMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 3958.8; // miles
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(h));
  return R * c;
}

function relTime(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function hotnessScore(p: Pin): number {
  const ageDays = Math.max(0.01, (Date.now() - (p.createdAt || 0)) / 86400000);
  const recency = 10 / ageDays; // newer => higher
  const likes = (p.likesCount || 0) * 1.0;
  const comments = (p.comments?.length || 0) * 1.5;
  return recency + likes + comments;
}

export default function ExploreFeed() {
  const { scheme } = useThemeStore();
  const tint = Colors[scheme ?? 'light'].tint;
  const navigation = useNavigation<any>();
  const { width: screenW } = useWindowDimensions();

  const pins = usePinsStore((s) => s.pins);
  const toggleLike = usePinsStore((s) => s.toggleLike);
  const addComment = usePinsStore((s) => s.addComment);

  const me = useSocialStore((s) => s.me().username);
  const following = useSocialStore((s) => s.following);
  const users = useSocialStore((s) => s.users);

  const setFocusPinId = useMapUiStore((s) => s.setFocusPinId);

  // Header search
  const [query, setQuery] = useState('');

  // Filters (moved to bottom sheet)
  const [radius, setRadius] = useState<number | null>(null); // miles; null=Anywhere

  // Comments sheet ref
  const commentsSheetRef = useRef<CommentsSheetRef>(null);

  // Location
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [loc, setLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const ensureLocation = useCallback(async () => {
    if (radius == null) return; // Anywhere no need
    try {
      setLoadingGeo(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status !== 'granted') {
        Alert.alert('Location needed', 'Enable location to filter by distance.');
        setLoc(null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      // ignore
    } finally {
      setLoadingGeo(false);
    }
  }, [radius]);

  useEffect(() => {
    if (radius != null) ensureLocation();
  }, [radius, ensureLocation]);

  // Compute visible pins: following + public pins
  const socialPins = useMemo(() => {
    const set = new Map<string, Pin>();
    for (const p of pins) {
      const owner = (p as any).owner ?? 'me';
      const isMine = owner === me || owner === 'me' || owner == null;
      const isFollowing = following.includes(owner);
      if (isFollowing && (p.privacy === 'public' || p.privacy === 'friends')) set.set(p.id, p);
      if (p.privacy === 'public' && !isMine) set.set(p.id, p);
    }
    return Array.from(set.values());
  }, [pins, me, following]);

  const filteredPins = useMemo(() => {
    let arr = socialPins;
    // text search on title/description
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter((p) =>
        (p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
      );
    }
    if (radius != null && loc) {
      arr = arr.filter(
        (p) =>
          !!p.coords &&
          typeof p.coords.latitude === 'number' &&
          typeof p.coords.longitude === 'number' &&
          haversineMiles(loc, p.coords) <= radius
      );
    }
    // If nothing matches, fall back to public pins to avoid empty explore
    if (arr.length === 0) {
      arr = pins.filter((p) => p.privacy === 'public');
    }
    // sort by hotness
    arr = [...arr].sort((a, b) => hotnessScore(b) - hotnessScore(a));
    return arr;
  }, [socialPins, query, radius, loc, pins]);

  // Infinite list
  const PAGE = 10;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [query, radius, loc, pins.length]);
  const visible = useMemo(() => filteredPins.slice(0, page * PAGE), [filteredPins, page]);

  const onEndReached = () => {
    if (visible.length < filteredPins.length) setPage((p) => p + 1);
  };

  const listRef = useRef<any>(null);

  const renderItem = useCallback(
    ({ item, index }: { item: Pin; index: number }) => {
      const owner = (item as any).owner ?? 'me';
      const u = users.find((x) => x.username === owner);
      const displayName = u?.displayName || owner;
      const where = loc && item.coords && typeof item.coords.latitude === 'number' && typeof item.coords.longitude === 'number'
        ? `${haversineMiles(loc, item.coords).toFixed(1)} mi`
        : '';

      return (
        <Card className="mb-4">
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{displayName?.[0]?.toUpperCase() || '?'}</Text>
              </View>
              <View>
                <Text weight="semibold" style={{ color: scheme === 'dark' ? '#f3f4f6' : '#111827' }}>{displayName}</Text>
                <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>{relTime(item.createdAt)}{where ? ` · ${where}` : ''}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {(item.categories || []).slice(0, 1).map((c) => (
                <View key={c} style={[styles.badge, styles.badgeDark]}>
                  <Text style={styles.badgeText}>{c}</Text>
                </View>
              ))}
              {item.privacy === 'public' ? (
                <View style={[styles.badge, styles.badgeGreen]}><Text style={styles.badgeText}>public</Text></View>
              ) : null}
            </View>
          </View>

          {/* Media */}
          <View style={{ marginTop: 10 }}>
            {item.photos && item.photos.length > 0 ? (
              <ImageGallery uris={item.photos} height={220} pageWidth={Math.max(1, Math.floor(screenW - 24))} borderRadius={12} />
            ) : (
              <View style={[styles.media, styles.mediaPlaceholder]}>
                <Icon name="image" family="Feather" size={26} color={scheme === 'dark' ? '#6b7280' : '#9ca3af'} />
              </View>
            )}
          </View>

          {/* Content */}
          <View style={{ marginTop: 10 }}>
            <Text weight="semibold" style={{ fontSize: 16, color: scheme === 'dark' ? '#f9fafb' : '#111827' }}>{item.title || 'Untitled Pin'}</Text>
            {!!item.description && (
              <Text style={{ marginTop: 6, color: scheme === 'dark' ? '#d1d5db' : '#374151' }}>{item.description}</Text>
            )}
          </View>

          {/* Comments preview */}
          {((item.comments?.length || 0) > 0) && (
            <View style={{ marginTop: 8 }}>
              {item.comments.slice(0, 2).map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', marginBottom: 2 }}>
                  <Text weight="semibold" style={{ color: scheme === 'dark' ? '#e5e7eb' : '#111827', marginRight: 6 }}>{c.user}</Text>
                  <Text style={{ color: scheme === 'dark' ? '#d1d5db' : '#374151' }}>{c.text}</Text>
                </View>
              ))}
              {item.comments.length > 2 && (
                <Pressable onPress={() => commentsSheetRef.current?.presentFor(item.id)}>
                  <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>View all {item.comments.length} comments</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => toggleLike(item.id)}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={item.myLiked ? 'Unlike' : 'Like'}
            >
              <Icon name={item.myLiked ? 'heart' : 'heart-outline'} family="Ionicons" size={22} color={item.myLiked ? '#ef4444' : scheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <Text style={styles.actionLabel}>{item.likesCount || 0}</Text>
            </Pressable>

            <Pressable
              onPress={() => commentsSheetRef.current?.presentFor(item.id)}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel="Comment"
            >
              <Icon name="message-circle" family="Feather" size={20} color={scheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <Text style={styles.actionLabel}>{item.comments?.length || 0}</Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                try {
                  await Share.share({
                    message: `${item.title || 'Pin'}\n${item.description || ''}\nhttps://maps.google.com/?q=${item.coords.latitude},${item.coords.longitude}`,
                  });
                } catch {}
              }}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel="Share"
            >
              <Icon name="share-2" family="Feather" size={20} color={scheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <Text style={styles.actionLabel}>Share</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFocusPinId(item.id);
                navigation.navigate('map');
              }}
              style={[styles.actionBtn, { marginLeft: 'auto' }]}
              accessibilityRole="button"
              accessibilityLabel="Show on Map"
            >
              <Icon name="map-pin" family="Feather" size={20} color={tint} />
              <Text style={[styles.actionLabel, { color: tint }]}>Show on Map</Text>
            </Pressable>
          </View>
          {/* Comment input removed in favor of comments sheet */}
        </Card>
      );
    },
    [users, loc, scheme, tint, toggleLike, setFocusPinId, navigation]
  );

  // Bottom sheet for filters (declare before HeaderBar to reference ref)
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = ['40%'];
  // Remove old comments sheet in favor of CommentsSheet component

  // Header with search + filters trigger
  const HeaderBar = (
    <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, backgroundColor: scheme === 'dark' ? '#000' : '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.searchWrap, scheme === 'dark' ? styles.searchDark : styles.searchLight]}>
          <Icon name="search" family="Feather" size={18} color={scheme === 'dark' ? '#9ca3af' : '#6b7280'} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={scheme === 'dark' ? '#6b7280' : '#9ca3af'}
            style={[styles.searchInput]}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
        <Pressable
          onPress={() => filterSheetRef.current?.present()}
          style={[styles.filterBtn, { marginLeft: 10 }]}
          accessibilityRole="button"
          accessibilityLabel="Filters"
        >
          <Icon name="sliders" family="Feather" size={18} color={scheme === 'dark' ? '#e5e7eb' : '#111827'} />
        </Pressable>
      </View>
      {loadingGeo && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <ActivityIndicator size="small" color={tint} />
          <Text style={{ marginLeft: 6, color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Updating location…</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: scheme === 'dark' ? '#000' : '#f8fafc' }}>
      {HeaderBar}
      <FlashList
        ref={listRef}
        data={visible}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        extraData={null}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.6}
        onEndReached={onEndReached}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 24 }}>
            <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>No pins match your filters.</Text>
          </View>
        }
      />
      {/* Comments bottom sheet */}
      <CommentsSheet ref={commentsSheetRef} />

      <BottomSheetModal
        ref={filterSheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
        )}
        handleIndicatorStyle={{ backgroundColor: scheme === 'dark' ? '#9ca3af' : '#9ca3af' }}
        backgroundStyle={{ backgroundColor: scheme === 'dark' ? '#111827' : '#ffffff' }}
      >
        <BottomSheetView style={{ padding: 16 }}>
          <Text weight="semibold" style={{ color: scheme === 'dark' ? '#f3f4f6' : '#111827', marginBottom: 12 }}>Filters</Text>
          <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280', marginBottom: 8 }}>Distance {radius == null ? '(Anywhere)' : `(${radius.toFixed(0)} mi)`}</Text>
          <MiniSlider
            value={radius == null ? 0 : radius}
            min={0}
            max={25}
            step={1}
            onChange={(v) => setRadius(v <= 0 ? null : Math.max(1, Math.min(25, Math.round(v))))}
            style={{ marginBottom: 16 }}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => {
                setRadius(null);
              }}
              style={[styles.footerBtn, styles.footerBtnSecondary]}
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
            >
              <Text weight="semibold" style={{ color: scheme === 'dark' ? '#e5e7eb' : '#111827' }}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => filterSheetRef.current?.dismiss()}
              style={[styles.footerBtn, styles.footerBtnPrimary]}
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
            >
              <Text weight="semibold" style={{ color: '#fff' }}>Apply</Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  media: { width: '100%', height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  mediaPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, marginLeft: 6 },
  badgeDark: { backgroundColor: '#111827' },
  badgeGreen: { backgroundColor: '#10b981' },
  badgeText: { color: '#ffffff', fontSize: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 18 },
  actionLabel: { marginLeft: 6, color: '#111827' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: '#ffffff', fontWeight: '700' },
  // Header search styles
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchLight: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  searchDark: { backgroundColor: '#0b0f15', borderColor: '#374151' },
  searchInput: { flex: 1, marginLeft: 8, paddingVertical: 0, color: '#111827' },
  filterBtn: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  footerBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footerBtnSecondary: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  footerBtnPrimary: { backgroundColor: '#111827' },
});
