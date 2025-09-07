import ImageGallery from '@/components/ui/ImageGallery';
import React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Switch, TextInput, ToastAndroid, View, Share, FlatList } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { Image as ExpoImage } from 'expo-image';
import * as Linking from 'expo-linking';
import { FlashList } from '@shopify/flash-list';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import Colors from '@/constants/Colors';
import { useThemeStore } from '@/lib/store/theme';
import { usePinsStore } from '@/lib/store/pins';
import type { Pin } from '@/lib/types/pin';
import { CategorySchema, PrivacySchema } from '@/lib/types/pin';
import { useNavigation } from 'expo-router';
import { useMapUiStore } from '@/lib/store/map';
import { useSocialStore } from '@/lib/store/social';

const DEFAULT_REGION: Region = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

type LongPressEvent = {
  nativeEvent: { coordinate: { latitude: number; longitude: number } };
};

const ACCESSORY_ID = 'pinFormAccessory';

const PinFormSchema = z.object({
  title: z.string().min(2, 'Title is too short').max(80, 'Title is too long'),
  description: z.string().max(500, 'Max 500 characters').optional().or(z.literal('')),
  categories: z.array(CategorySchema).optional(),
  photos: z.array(z.string()).max(6, 'You can attach up to 6 photos').optional(),
  privacy: PrivacySchema,
  coords: z.object({ latitude: z.number(), longitude: z.number() }),
});

type PinFormValues = z.infer<typeof PinFormSchema>;

// Header chips as a standalone component so it doesn't re-register header options on every state change
function HeaderFilterChips() {
  const { scheme } = useThemeStore();
  const privacyFilter = useMapUiStore((s) => s.privacyFilter);
  const setPrivacyFilter = useMapUiStore((s) => s.setPrivacyFilter);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {([
        { key: 'all', label: 'All' },
        { key: 'private', label: 'Private' },
        { key: 'friends', label: 'Friends' },
        { key: 'public', label: 'Public' },
        { key: 'following', label: 'Following' },
      ] as const).map((opt) => {
        const selected = privacyFilter === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => setPrivacyFilter(opt.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.filterChip, selected ? styles.filterChipSelected : styles.filterChipUnselected]}
          >
            <Text style={selected ? styles.filterChipTextSelected : styles.filterChipText}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const { scheme } = useThemeStore();
  const tint = Colors[scheme ?? 'light'].tint;
  const navigation = useNavigation();

  const pins = usePinsStore((s) => s.pins);
  const addPin = usePinsStore((s) => s.addPin);
  const addComment = usePinsStore((s) => s.addComment);
  const toggleLike = usePinsStore((s) => s.toggleLike);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['80%'], []);

  // Keep active pin in sync with store updates (e.g., ratings/comments)
  const activePin = usePinsStore((s) => (selectedPin ? s.pins.find((p) => p.id === selectedPin.id) || null : null));
  const [commentText, setCommentText] = useState('');

  // Create/Edit sheet
  const createSheetRef = useRef<BottomSheetModal>(null);
  // (unused after moving to 90%/100%)
  // const createSnapPoints = useMemo(() => ['60%'], []);
  const [baseCoords, setBaseCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [useCurrent, setUseCurrent] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCoords, setDraftCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [step, setStep] = useState(0); // 0: basics, 1: media+categories, 2: privacy+location
  const titleRef = useRef<TextInput | null>(null);

  // Persistent image caching helpers
  const ensurePhotosDir = useCallback(async () => {
    const dir = FileSystem.documentDirectory;
    if (!dir) return null;
    const photosDir = `${dir}photos`;
    try {
      const info = await FileSystem.getInfoAsync(photosDir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
      }
      return photosDir;
    } catch {
      return null;
    }
  }, []);

  const getExt = (uri: string) => {
    const m = uri.match(/\.(\w+)(?:\?|$)/);
    const ext = (m?.[1] || 'jpg').toLowerCase();
    return ext.length <= 5 ? ext : 'jpg';
  };

  const isAppPhotoUri = (uri: string) => {
    const dir = FileSystem.documentDirectory;
    return !!dir && uri.startsWith(`${dir}photos/`);
  };

  const cacheToAppDocs = useCallback(async (uri: string): Promise<string> => {
    try {
      // If already in our app photos dir, return as-is
      if (isAppPhotoUri(uri)) return uri;
      const photosDir = await ensurePhotosDir();
      if (!photosDir) return uri; // fallback: return original
      const ext = getExt(uri);
      const name = `pin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const dest = `${photosDir}/${name}`;
      // Some URIs can be content://; copyAsync handles both file and content
      await FileSystem.copyAsync({ from: uri, to: dest });
      return dest;
    } catch {
      return uri;
    }
  }, [ensurePhotosDir]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(PinFormSchema),
    defaultValues: {
      title: 'New pin',
      description: '',
      categories: [],
      photos: [],
      privacy: 'private',
      coords: { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude },
    },
  });
  const photos = watch('photos');

  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [hasLocation, setHasLocation] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Using iOS-native keyboard interactions (interactive dismiss, InputAccessoryView) — no explicit listeners needed

  const requestAndCenter = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status !== 'granted') {
        setHasLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const nextRegion: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(nextRegion);
      setHasLocation(true);
      // Smoothly animate to user's location
      requestAnimationFrame(() => {
        mapRef.current?.animateToRegion(nextRegion, 600);
      });
    } catch (e) {
      // noop for now; keep default region
      setHasLocation(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestAndCenter();
  }, [requestAndCenter]);

  const openCreateForm = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      setEditingId(null);
      setBaseCoords(coords);
      setUseCurrent(false);
      reset({ title: 'New pin', description: '', categories: [], photos: [], privacy: 'private', coords });
      setDraftCoords(coords);
      setStep(0);
      // show sheet
      createSheetRef.current?.present();
      // ensure full height on open
      setTimeout(() => {
        createSheetRef.current?.snapToIndex?.(1);
      }, 100);
    },
    [reset]
  );

  const onMapPress = useCallback(
    (e: LongPressEvent & { nativeEvent: any }) => {
      // Ignore marker presses to avoid opening create sheet when tapping existing pins
      if (e?.nativeEvent?.action === 'marker-press') return;
      const { coordinate } = e.nativeEvent;
      openCreateForm({ latitude: coordinate.latitude, longitude: coordinate.longitude });
    },
    [openCreateForm]
  );

  const onLongPress = onMapPress;

  const recenter = useCallback(async () => {
    if (permissionStatus !== 'granted') {
      await requestAndCenter();
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({});
      const nextRegion: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 600);
    } catch {}
  }, [permissionStatus, requestAndCenter]);

  const useCurrentLocationAsPin = useCallback(async () => {
    if (permissionStatus !== 'granted') {
      await requestAndCenter();
    }
    try {
      Keyboard.dismiss();
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      openCreateForm(coords);
      const nextRegion: Region = { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 600);
    } catch {}
  }, [permissionStatus, requestAndCenter, openCreateForm]);

  // Inject header chip group once; the component subscribes to Zustand store and re-renders independently
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerTitle: () => <HeaderFilterChips /> });
  }, [navigation, scheme]);

  const privacyFilter = useMapUiStore((s) => s.privacyFilter);
  const focusPinId = useMapUiStore((s) => s.focusPinId);
  const setFocusPinId = useMapUiStore((s) => s.setFocusPinId);
  const meUser = useSocialStore((s) => s.me().username);
  const following = useSocialStore((s) => s.following);
  const visiblePins = useMemo(() => {
    return pins.filter((p) => {
      if (!p || !p.coords || typeof p.coords.latitude !== 'number' || typeof p.coords.longitude !== 'number') return false;
      const owner = (p as any).owner ?? 'me';
      const isMine = owner === meUser || owner === 'me' || owner == null;
      if (isMine) return true; // always see your own
      if (p.privacy === 'public') return true; // everyone sees
      if (p.privacy === 'friends' && following.includes(owner)) return true; // friends-only
      return false; // others' private or friends without following
    });
  }, [pins, meUser, following]);
  const filteredPins = useMemo(() => {
    if (privacyFilter === 'all') return visiblePins;
    if (privacyFilter === 'following') return visiblePins.filter((p) => {
      const owner = (p as any).owner ?? 'me';
      const isMine = owner === meUser || owner === 'me' || owner == null;
      return !isMine && following.includes(owner);
    });
    return visiblePins.filter((p) => p.privacy === privacyFilter);
  }, [visiblePins, privacyFilter, following, meUser]);

  const categoryStyle = useCallback((p: Pin) => {
    const primary = p.categories?.[0] ?? 'other';
    // Choose icon + color by category
    switch (primary) {
      case 'cafe':
        return { bg: '#EA580C', icon: 'coffee', family: 'Feather' as const };
      case 'art':
        return { bg: '#9333EA', icon: 'image', family: 'Feather' as const };
      case 'study':
        return { bg: '#2563EB', icon: 'book', family: 'Feather' as const };
      case 'smoke':
        return { bg: '#374151', icon: 'wind', family: 'Feather' as const };
      case 'landmark':
        return { bg: '#16A34A', icon: 'flag', family: 'Feather' as const };
      case 'nature':
        return { bg: '#059669', icon: 'leaf', family: 'Ionicons' as const };
      default:
        return { bg: '#111827', icon: 'map-pin', family: 'Feather' as const };
    }
  }, []);

  const markers = useMemo(
    () =>
      filteredPins.map((p) => {
        const sty = categoryStyle(p);
        return (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.coords.latitude, longitude: p.coords.longitude }}
            accessibilityLabel={`Pin at latitude ${p.coords.latitude.toFixed(4)}, longitude ${p.coords.longitude.toFixed(4)}`}
            tracksViewChanges={true}
            onCalloutPress={() => {
              setSelectedPin(p);
              bottomSheetRef.current?.present();
            }}
          >
            {/* Custom marker by category */}
            <View style={[styles.markerWrapper, { shadowColor: '#000' }]}> 
              <View style={[styles.markerBubble, { backgroundColor: sty.bg }]}> 
                <Icon name={sty.icon as any} family={sty.family} size={14} color="#ffffff" />
              </View>
              <View style={[styles.markerTip, { borderTopColor: sty.bg }]} />
            </View>
            <Callout tooltip>
              <View style={styles.callout} accessible accessibilityRole="button" accessibilityLabel={`View details for ${p.title || 'Untitled Pin'}`}>
                <Text weight="semibold" style={styles.calloutTitle}>
                  {p.title || 'Untitled Pin'}
                </Text>
                <View style={styles.calloutCtaRow}>
                  <Text weight="medium" style={styles.calloutCtaText}>
                    Details
                  </Text>
                  <Icon name="chevron-right" family="Feather" size={16} color="#111827" />
                </View>
                <View style={styles.calloutArrow} />
              </View>
            </Callout>
          </Marker>
        );
      }),
    [filteredPins, categoryStyle]
  );

  // Respond to focusPinId updates (from Explore "Show on Map")
  useEffect(() => {
    if (!focusPinId) return;
    const target = pins.find((p) => p.id === focusPinId) || null;
    if (target && target.coords && typeof target.coords.latitude === 'number' && typeof target.coords.longitude === 'number') {
      setSelectedPin(target);
      const nextRegion: Region = {
        latitude: target.coords.latitude,
        longitude: target.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      requestAnimationFrame(() => {
        mapRef.current?.animateToRegion(nextRegion, 600);
        setTimeout(() => bottomSheetRef.current?.present(), 150);
      });
    }
    setFocusPinId(null);
  }, [focusPinId, pins, setFocusPinId]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onLongPress={onLongPress}
        onPress={onMapPress}
        onRegionChangeComplete={(r: Region) => setRegion(r)}
        accessibilityLabel="Map"
        showsUserLocation={permissionStatus === 'granted'}
      >
        {markers}
        {draftCoords && (
          <Marker
            key="draft"
            coordinate={draftCoords}
            pinColor="#3b82f6"
            accessibilityLabel="Draft pin location"
          />
        )}
      </MapView>

      {/* Recenter FAB */}
      <Pressable
        onPress={recenter}
        accessibilityRole="button"
        accessibilityLabel="Recenter to current location"
        style={[styles.fab, { backgroundColor: scheme === 'dark' ? '#1f2937' : '#ffffff', shadowColor: '#000' }]}
      >
        <Icon name="crosshair" family="Feather" size={22} color={tint} />
      </Pressable>

      {/* Use current location button */}
      <Pressable
        onPress={useCurrentLocationAsPin}
        accessibilityRole="button"
        accessibilityLabel="Drop a pin at your current location"
        style={[styles.useCurrentBtn, { backgroundColor: scheme === 'dark' ? '#111827' : '#111827' }]}
      >
        <Icon name="plus" family="Feather" size={18} color="#ffffff" />
        <Text weight="semibold" style={{ color: '#ffffff', marginLeft: 8 }}>
          Use current location
        </Text>
      </Pressable>

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={tint} />
          <Text style={{ marginTop: 8, color: scheme === 'dark' ? '#d1d5db' : '#4b5563' }}>Fetching location…</Text>
        </View>
      )}

      {permissionStatus === 'denied' && !hasLocation && (
        <View style={styles.permissionBanner}>
          <Text weight="semibold" style={{ color: '#ffffff' }}>
            Location permission denied. Enable it in Settings to recenter.
          </Text>
        </View>
      )}

      {/* Bottom Sheet for Pin Details */}
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
        )}
        handleIndicatorStyle={{ backgroundColor: scheme === 'dark' ? '#9ca3af' : '#9ca3af' }}
        backgroundStyle={{ backgroundColor: scheme === 'dark' ? '#111827' : '#ffffff' }}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.sheetContent, { paddingBottom: 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {activePin && (
            <View>
              {/* Media carousel */}
              <View style={styles.mediaCarousel}>
                {activePin.photos && activePin.photos.length > 0 ? (
                  <ImageGallery uris={activePin.photos} height={180} containerPaddingHorizontal={16} />
                ) : (
                  <View style={{ paddingHorizontal: 16 }}>
                    <View style={[styles.mediaItem, styles.mediaPlaceholder]}>
                      <Icon name="image" family="Feather" size={24} color={scheme === 'dark' ? '#6b7280' : '#9ca3af'} />
                      <Text style={{ marginTop: 6, color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>No photos</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Header row: title + edit (if mine) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <Text weight="bold" style={{ fontSize: 18, color: scheme === 'dark' ? '#f9fafb' : '#111827' }}>
                  {activePin.title || 'Untitled Pin'}
                </Text>
                {(((activePin as any).owner ?? 'me') === meUser || ((activePin as any).owner ?? 'me') === 'me') && (
                  <Pressable
                    onPress={() => {
                      setEditingId(activePin.id);
                      reset({
                        title: activePin.title || '',
                        description: activePin.description || '',
                        categories: activePin.categories || [],
                        photos: activePin.photos || [],
                        privacy: activePin.privacy,
                        coords: activePin.coords,
                      });
                      bottomSheetRef.current?.dismiss();
                      createSheetRef.current?.present();
                      setTimeout(() => {
                        titleRef.current?.focus?.();
                      }, 250);
                    }}
                    style={[styles.saveBtn, { backgroundColor: tint }]}
                    accessibilityRole="button"
                    accessibilityLabel="Edit pin"
                  >
                    <Text weight="semibold" style={{ color: '#fff' }}>Edit</Text>
                  </Pressable>
                )}
              </View>

              {/* Meta row: category, privacy, createdAt */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                {(activePin.categories || []).slice(0, 1).map((c) => (
                  <View key={c} style={[styles.badge, styles.badgeNeutral]}> 
                    <Text style={styles.badgeText}>{c}</Text>
                  </View>
                ))}
                <View style={[styles.badge, activePin.privacy === 'public' ? styles.badgeGreen : activePin.privacy === 'friends' ? styles.badgeBlue : styles.badgeGray]}>
                  <Text style={styles.badgeText}>{activePin.privacy}</Text>
                </View>
                <Text style={{ marginLeft: 6, color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                  {new Date(activePin.createdAt).toLocaleDateString()}
                </Text>
              </View>
              {!!activePin.description && (
                <Text style={{ marginTop: 8, color: scheme === 'dark' ? '#d1d5db' : '#374151' }}>{activePin.description}</Text>
              )}

              {/* Coordinates */}
              <Text style={{ marginTop: 6, color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                Lat: {activePin.coords.latitude.toFixed(5)} · Lng: {activePin.coords.longitude.toFixed(5)}
              </Text>

              {/* Likes section (Instagram-style hearts) */}
              <View style={{ marginTop: 14 }}>
                <View style={styles.likeRow}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleLike(activePin.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={activePin.myLiked ? 'Unlike' : 'Like'}
                    style={{ paddingVertical: 4, paddingRight: 8 }}
                  >
                    <Icon
                      name={activePin.myLiked ? 'heart' : 'heart-outline'}
                      family="Ionicons"
                      size={26}
                      color={activePin.myLiked ? '#ef4444' : scheme === 'dark' ? '#9ca3af' : '#6b7280'}
                    />
                  </Pressable>
                  <Text weight="semibold" style={{ color: scheme === 'dark' ? '#e5e7eb' : '#111827' }}>
                    {activePin.likesCount || 0} {((activePin.likesCount || 0) === 1) ? 'like' : 'likes'}
                  </Text>
                </View>
              </View>

              {/* Actions row */}
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={async () => {
                    try {
                      await Share.share({
                        message: `${activePin.title || 'Pin'}\n${activePin.description || ''}\nhttps://maps.google.com/?q=${activePin.coords.latitude},${activePin.coords.longitude}`,
                      });
                    } catch {}
                  }}
                >
                  <Icon name="share-2" family="Feather" size={18} color={scheme === 'dark' ? '#e5e7eb' : '#111827'} />
                  <Text style={styles.actionLabel}>Share</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    const { latitude, longitude } = activePin.coords;
                    const title = encodeURIComponent(activePin.title || 'Pin');
                    const ios = `http://maps.apple.com/?ll=${latitude},${longitude}&q=${title}`;
                    const android = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${title})`;
                    const web = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                    const url = Platform.OS === 'ios' ? ios : Platform.OS === 'android' ? android : web;
                    Linking.openURL(url);
                  }}
                >
                  <Icon name="navigation" family="Feather" size={18} color={scheme === 'dark' ? '#e5e7eb' : '#111827'} />
                  <Text style={styles.actionLabel}>Navigate</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => Alert.alert('Report', 'Thanks! We will review this pin.')}
                >
                  <Icon name="flag" family="Feather" size={18} color={scheme === 'dark' ? '#e5e7eb' : '#111827'} />
                  <Text style={styles.actionLabel}>Report</Text>
                </Pressable>
              </View>

              {/* Comments */}
              <View style={{ marginTop: 12 }}>
                <Text weight="semibold" style={{ color: scheme === 'dark' ? '#f3f4f6' : '#111827', marginBottom: 6 }}>Comments</Text>
                <View style={styles.commentRow}>
                  <TextInput
                    value={commentText}
                    onChangeText={setCommentText}
                    keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
                    inputAccessoryViewID={Platform.OS === 'ios' ? 'commentAccessory' : undefined}
                    placeholder="Add a comment"
                    placeholderTextColor={scheme === 'dark' ? '#6b7280' : '#9ca3af'}
                    style={[styles.commentInput, scheme === 'dark' ? styles.inputDark : styles.inputLight]}
                  />
                  <Pressable
                    onPress={() => {
                      const txt = commentText.trim();
                      if (!txt) return;
                      // mock users
                      const users = ['Alex', 'Sam', 'Taylor', 'Jordan', 'Casey'];
                      const user = users[Math.floor(Math.random() * users.length)];
                      addComment(activePin.id, { user, text: txt });
                      setCommentText('');
                    }}
                    style={[styles.postBtn, { backgroundColor: tint }]}
                    accessibilityRole="button"
                    accessibilityLabel="Post comment"
                  >
                    <Text weight="semibold" style={{ color: '#fff' }}>Post</Text>
                  </Pressable>
                </View>

                <View style={{ marginTop: 8 }}>
                  <FlashList
                    data={activePin.comments || []}
                    keyExtractor={(c) => c.id}
                    renderItem={({ item }) => (
                      <View style={styles.commentItem}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{item.user?.[0]?.toUpperCase() || '?'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text weight="semibold" style={{ color: scheme === 'dark' ? '#e5e7eb' : '#111827' }}>{item.user}</Text>
                            <Text style={{ color: scheme === 'dark' ? '#6b7280' : '#9ca3af', fontSize: 12 }}>
                              {new Date(item.createdAt).toLocaleString()}
                            </Text>
                          </View>
                          <Text style={{ color: scheme === 'dark' ? '#d1d5db' : '#374151', marginTop: 2 }}>{item.text}</Text>
                        </View>
                      </View>
                    )}
                    nestedScrollEnabled
                    style={{ maxHeight: 220 }}
                  />
                </View>
              </View>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={ACCESSORY_ID} backgroundColor={scheme === 'dark' ? '#111827' : '#ffffff'}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb', alignItems: 'flex-end' }}>
            <Pressable onPress={() => Keyboard.dismiss()} accessibilityRole="button" accessibilityLabel="Done">
              <Text weight="semibold" style={{ color: Colors[scheme ?? 'light'].tint }}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      {/* iOS comment accessory with quick emojis */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="commentAccessory" backgroundColor={scheme === 'dark' ? '#111827' : '#ffffff'}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row' }}>
              {['😀', '🔥', '😍', '👏', '👍', '🎉'].map((e) => (
                <Pressable key={e} onPress={() => setCommentText((t) => (t || '') + e)} style={{ paddingHorizontal: 6 }}>
                  <Text style={{ fontSize: 18 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => Keyboard.dismiss()} accessibilityRole="button" accessibilityLabel="Done">
              <Text weight="semibold" style={{ color: Colors[scheme ?? 'light'].tint }}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      {/* Bottom Sheet for Create/Edit Pin */}
      <BottomSheetModal
        ref={createSheetRef}
        snapPoints={["90%", "100%"]}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={() => {
          setDraftCoords(null);
          setEditingId(null);
          setStep(0);
        }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
        )}
        handleIndicatorStyle={{ backgroundColor: scheme === 'dark' ? '#9ca3af' : '#9ca3af' }}
        backgroundStyle={{ backgroundColor: scheme === 'dark' ? '#111827' : '#ffffff' }}
      >
        <BottomSheetView style={[styles.sheetContent, { paddingBottom: 0 }]}> 
          {/* Header */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text weight="bold" style={{ fontSize: 18, color: scheme === 'dark' ? '#f9fafb' : '#111827', marginRight: 8 }}>
                {editingId ? 'Edit Pin' : 'Create Pin'}
              </Text>
              <Text style={styles.stepIndicator}>{`${Math.min(2, Math.max(0, step)) + 1}/3`}</Text>
            </View>
            <Pressable
              onPress={() => {
                createSheetRef.current?.dismiss();
                setDraftCoords(null);
                setEditingId(null);
                setStep(0);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <Icon name="x" family="Feather" size={20} color={scheme === 'dark' ? '#9ca3af' : '#6b7280'} />
            </Pressable>
          </View>

          <BottomSheetScrollView
            contentContainerStyle={{ paddingBottom: 96 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {step === 0 && (
              <View>
                {/* Title */}
                <Text style={styles.label}>Title</Text>
                <Controller
                  control={control}
                  name="title"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      ref={titleRef}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      placeholder="Give it a name"
                      style={[styles.input, scheme === 'dark' ? styles.inputDark : styles.inputLight]}
                      accessibilityLabel="Title"
                      onFocus={() => createSheetRef.current?.snapToIndex?.(1)}
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      inputAccessoryViewID={Platform.OS === 'ios' ? ACCESSORY_ID : undefined}
                    />
                  )}
                />
                {errors.title && (
                  <Text style={styles.errorText}>{errors.title.message as string}</Text>
                )}

                {/* Description */}
                <Text style={styles.label}>Description</Text>
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      placeholder="Optional notes"
                      style={[styles.textarea, scheme === 'dark' ? styles.inputDark : styles.inputLight]}
                      multiline
                      numberOfLines={4}
                      accessibilityLabel="Description"
                      onFocus={() => createSheetRef.current?.snapToIndex?.(1)}
                      returnKeyType="default"
                    />
                  )}
                />
                {errors.description && (
                  <Text style={styles.errorText}>{errors.description.message as string}</Text>
                )}
              </View>
            )}

            {step === 1 && (
              <View>
                {/* Categories */}
                <Text style={styles.label}>Categories</Text>
                <Controller
                  control={control}
                  name="categories"
                  render={({ field: { value, onChange } }) => {
                    const all = ['art', 'cafe', 'study', 'smoke', 'landmark', 'nature', 'other'] as const;
                    const toggle = (c: string) => {
                      const next = value?.includes(c as any)
                        ? (value || []).filter((x) => x !== c)
                        : ([...(value || []), c] as any);
                      onChange(next);
                    };
                    return (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {all.map((c) => (
                          <Pressable
                            key={c}
                            onPress={() => toggle(c)}
                            accessibilityRole="button"
                            accessibilityLabel={`Toggle ${c}`}
                            style={[styles.chip, (value || []).includes(c) ? styles.chipSelected : styles.chipUnselected]}
                          >
                            <Text style={(value || []).includes(c) ? styles.chipTextSelected : styles.chipText}>{c}</Text>
                          </Pressable>
                        ))}
                      </View>
                    );
                  }}
                />

                {/* Photos */}
                <Text style={styles.label}>Photos</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {photos?.map((uri, idx) => (
                    <View key={uri} style={styles.photoItem}>
                      <ExpoImage source={{ uri }} style={styles.photo} contentFit="cover" cachePolicy="memory-disk" />
                      <Pressable style={styles.photoRemove} onPress={() => setValue('photos', photos.filter((_, i) => i !== idx))} accessibilityLabel="Remove photo">
                        <Icon name="x" family="Feather" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  {(photos?.length || 0) < 6 && (
                    <>
                      <Pressable
                        onPress={async () => {
                          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (status !== 'granted') {
                            Alert.alert('Permission required', 'We need access to your photo library to select images.');
                            return;
                          }
                          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8, selectionLimit: 6 - (photos?.length || 0) });
                          if (!result.canceled) {
                            const uris = result.assets.map((a) => a.uri);
                            setValue('photos', [...(photos || []), ...uris]);
                          }
                        }}
                        style={[styles.photoAdd, { marginRight: 8 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Add photos from library"
                      >
                        <Icon name="image" family="Feather" size={18} color={tint} />
                        <Text style={{ marginLeft: 6, color: tint }}>Library</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          const { status } = await ImagePicker.requestCameraPermissionsAsync();
                          if (status !== 'granted') {
                            Alert.alert('Permission required', 'We need access to your camera to take photos.');
                            return;
                          }
                          const result = await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });
                          if (!result.canceled) {
                            const uri = result.assets[0].uri;
                            setValue('photos', [...(photos || []), uri]);
                          }
                        }}
                        style={styles.photoAdd}
                        accessibilityRole="button"
                        accessibilityLabel="Add photo from camera"
                      >
                        <Icon name="camera" family="Feather" size={18} color={tint} />
                        <Text style={{ marginLeft: 6, color: tint }}>Camera</Text>
                      </Pressable>
                    </>
                  )}
                </View>
                {errors.photos && <Text style={styles.errorText}>{errors.photos.message as string}</Text>}
              </View>
            )}

            {step === 2 && (
              <View>
                {/* Privacy */}
                <Text style={styles.label}>Privacy</Text>
                <Controller
                  control={control}
                  name="privacy"
                  render={({ field: { value, onChange } }) => (
                    <View style={{ flexDirection: 'row' }}>
                      {(
                        [
                          { key: 'private', label: 'Private' },
                          { key: 'friends', label: 'Friends' },
                          { key: 'public', label: 'Public' },
                        ] as const
                      ).map((opt) => (
                        <Pressable
                          key={opt.key}
                          onPress={() => onChange(opt.key)}
                          style={[styles.radio, value === opt.key ? styles.radioSelected : styles.radioUnselected]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: value === opt.key }}
                        >
                          <Text style={value === opt.key ? styles.radioTextSelected : styles.radioText}>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                />

                {/* Location */}
                <Text style={styles.label}>Location</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#4b5563' }}>Use current location</Text>
                  <Switch
                    value={useCurrent}
                    onValueChange={async (v) => {
                      setUseCurrent(v);
                      if (v) {
                        try {
                          if (permissionStatus !== 'granted') {
                            const { status } = await Location.requestForegroundPermissionsAsync();
                            setPermissionStatus(status);
                            if (status !== 'granted') return;
                          }
                          const loc = await Location.getCurrentPositionAsync({});
                          setValue('coords', { latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                          setDraftCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                        } catch {}
                      } else if (baseCoords) {
                        setValue('coords', baseCoords);
                        setDraftCoords(baseCoords);
                      }
                    }}
                  />
                </View>
                <Text style={{ marginTop: 6, color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                  Lat: {watch('coords').latitude.toFixed(5)} · Lng: {watch('coords').longitude.toFixed(5)}
                </Text>
              </View>
            )}
          </BottomSheetScrollView>

          {/* Sticky footer actions */}
          <View style={styles.sheetFooter}>
            {step > 0 && (
              <Pressable
                onPress={() => setStep((s) => Math.max(0, s - 1))}
                style={[styles.footerBtn, styles.footerBtnSecondary]}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Text weight="semibold" style={{ color: scheme === 'dark' ? '#111827' : '#111827' }}>Back</Text>
              </Pressable>
            )}

            {step < 2 ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setStep((s) => Math.min(2, s + 1));
                }}
                style={[styles.footerBtn, styles.footerBtnPrimary, { backgroundColor: tint }]}
                accessibilityRole="button"
                accessibilityLabel="Next"
                disabled={step === 0 && (!!errors.title || !watch('title') || (watch('title')?.length ?? 0) < 2)}
              >
                <Text weight="semibold" style={{ color: '#fff' }}>Next</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSubmit(async (values) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  try {
                    const data = PinFormSchema.parse(values);
                    // Cache photos to persistent app directory and use those URIs
                    const persistedPhotos = await Promise.all((data.photos || []).map((u) => cacheToAppDocs(u)));
                    if (editingId) {
                      usePinsStore.getState().updatePin(editingId, {
                        title: data.title,
                        description: data.description || '',
                        coords: data.coords,
                        photos: persistedPhotos,
                        categories: data.categories || [],
                        privacy: data.privacy,
                      });
                    } else {
                      addPin({
                        title: data.title,
                        description: data.description || '',
                        coords: data.coords,
                        photos: persistedPhotos,
                        categories: data.categories || [],
                        privacy: data.privacy,
                        owner: meUser,
                      });
                    }
                    createSheetRef.current?.dismiss();
                    if (Platform.OS === 'android') {
                      ToastAndroid.show(editingId ? 'Pin updated' : 'Pin created', ToastAndroid.SHORT);
                    } else {
                      Alert.alert('Saved', editingId ? 'Pin updated' : 'Pin created');
                    }
                    setDraftCoords(null);
                  } catch (e: any) {
                    Alert.alert('Error', 'Please fix the validation errors');
                  }
                })}
                style={[styles.footerBtn, styles.footerBtnPrimary, { backgroundColor: tint }]}
                accessibilityRole="button"
                accessibilityLabel={editingId ? 'Update pin' : 'Save pin'}
                disabled={isSubmitting}
              >
                <Text weight="semibold" style={{ color: '#fff' }}>{isSubmitting ? (editingId ? 'Updating…' : 'Saving…') : (editingId ? 'Update' : 'Save')}</Text>
              </Pressable>
            )}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  // Header filter chips
  filterChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, marginRight: 6, borderWidth: 1 },
  filterChipSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  filterChipUnselected: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  filterChipText: { color: '#111827', fontSize: 13 },
  filterChipTextSelected: { color: '#ffffff', fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  useCurrentBtn: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 48,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callout: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  calloutTitle: { color: '#111827' },
  calloutCtaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  calloutCtaText: { color: '#111827', marginRight: 4 },
  calloutArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
  // Custom marker styles
  markerWrapper: {
    alignItems: 'center',
  },
  markerBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  markerTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnSecondary: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  footerBtnPrimary: {
    backgroundColor: '#111827',
  },
  label: { marginTop: 14, marginBottom: 6, color: '#6b7280' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputLight: { backgroundColor: '#fff' },
  inputDark: { backgroundColor: '#111827', color: '#f9fafb', borderColor: '#374151' },
  errorText: { color: '#ef4444', marginTop: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, marginRight: 8, marginBottom: 8, borderWidth: 1 },
  chipSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  chipUnselected: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  chipText: { color: '#111827' },
  chipTextSelected: { color: '#ffffff' },
  photoItem: { width: 72, height: 72, borderRadius: 8, overflow: 'hidden', marginRight: 8, marginBottom: 8 },
  photo: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  photoAdd: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  radio: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  radioSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  radioUnselected: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  radioText: { color: '#111827' },
  radioTextSelected: { color: '#ffffff' },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  closeBtn: { position: 'absolute', right: 0, top: 0, padding: 8 },
  stepIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 12,
    color: '#111827',
    backgroundColor: '#e5e7eb',
  },
  // Pin Details additions
  mediaCarousel: { marginHorizontal: -16, height: 180 },
  mediaItem: { width: '100%', height: 180 },
  mediaPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, marginRight: 6 },
  badgeNeutral: { backgroundColor: '#111827' },
  badgeText: { color: '#ffffff', fontSize: 12 },
  badgeGreen: { backgroundColor: '#10b981' },
  badgeBlue: { backgroundColor: '#3b82f6' },
  badgeGray: { backgroundColor: '#6b7280' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  likeRow: { flexDirection: 'row', alignItems: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionLabel: { marginLeft: 6, color: '#111827' },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  postBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  commentItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontWeight: '600' },
});
