import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import Colors from '@/constants/Colors';
import { useThemeStore } from '@/lib/store/theme';
import { usePinsStore } from '@/lib/store/pins';
import type { Pin } from '@/lib/types/pin';

const DEFAULT_REGION: Region = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

type LongPressEvent = {
  nativeEvent: { coordinate: { latitude: number; longitude: number } };
};

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const { scheme } = useThemeStore();
  const tint = Colors[scheme ?? 'light'].tint;

  const pins = usePinsStore((s) => s.pins);
  const addPin = usePinsStore((s) => s.addPin);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['60%'], []);

  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [hasLocation, setHasLocation] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

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

  const onLongPress = useCallback(
    (e: LongPressEvent) => {
      const { coordinate } = e.nativeEvent;
      addPin({
        title: 'Untitled Pin',
        description: '',
        coords: { latitude: coordinate.latitude, longitude: coordinate.longitude },
        privacy: 'private',
      });
    },
    [addPin]
  );

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
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      addPin({ title: 'Untitled Pin', description: '', coords, privacy: 'private' });
      const nextRegion: Region = { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 600);
    } catch {}
  }, [addPin, permissionStatus, requestAndCenter]);

  const markers = useMemo(
    () =>
      pins.map((p) => (
        <Marker
          key={p.id}
          coordinate={{ latitude: p.coords.latitude, longitude: p.coords.longitude }}
          accessibilityLabel={`Pin at latitude ${p.coords.latitude.toFixed(4)}, longitude ${p.coords.longitude.toFixed(4)}`}
          onCalloutPress={() => {
            setSelectedPin(p);
            bottomSheetRef.current?.present();
          }}
        >
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
      )),
    [pins]
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onLongPress={onLongPress}
        onRegionChangeComplete={(r: Region) => setRegion(r)}
        accessibilityLabel="Map"
      >
        {markers}
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
        handleIndicatorStyle={{ backgroundColor: scheme === 'dark' ? '#9ca3af' : '#9ca3af' }}
        backgroundStyle={{ backgroundColor: scheme === 'dark' ? '#111827' : '#ffffff' }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text weight="bold" style={{ fontSize: 18, color: scheme === 'dark' ? '#f9fafb' : '#111827' }}>
            {selectedPin?.title || 'Untitled Pin'}
          </Text>
          <Text style={{ marginTop: 6, color: scheme === 'dark' ? '#9ca3af' : '#4b5563' }}>
            Full pin details coming soon.
          </Text>
          {!!selectedPin && (
            <Text style={{ marginTop: 8, color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>
              Lat: {selectedPin.coords.latitude.toFixed(5)} · Lng: {selectedPin.coords.longitude.toFixed(5)}
            </Text>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
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
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
});
