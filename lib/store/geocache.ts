import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';
import * as Location from 'expo-location';

export type GeoEntry = {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  updatedAt: number;
};

export type GeoCacheState = {
  cache: Record<string, GeoEntry>;
  upsert: (key: string, value: GeoEntry) => void;
  getCityDisplay: (key: string) => string | null;
};

export const useGeoCache = create<GeoCacheState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        cache: {},
        upsert: (key, value) => set((s) => ({ cache: { ...s.cache, [key]: value } })),
        getCityDisplay: (key) => {
          const v = get().cache[key];
          if (!v) return null;
          const city = v.city || v.region || null;
          const cc = v.countryCode || v.country || null;
          return city && cc ? `${city}, ${cc}` : city || cc || null;
        },
      }),
      {
        name: 'pindrop-geocache',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (s) => ({ cache: s.cache }),
      }
    )
  )
);

export async function resolveCity(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`; // group close points
  const cached = useGeoCache.getState().getCityDisplay(key);
  if (cached) return cached;
  try {
    const res = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const first = res?.[0];
    const entry: GeoEntry = {
      city: first?.city || first?.subregion || null,
      region: first?.region || null,
      country: first?.country || null,
      countryCode: (first as any)?.isoCountryCode || null,
      updatedAt: Date.now(),
    };
    useGeoCache.getState().upsert(key, entry);
    const disp = useGeoCache.getState().getCityDisplay(key);
    return disp;
  } catch {
    return null;
  }
}
