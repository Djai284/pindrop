import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';

export type ThemeScheme = 'light' | 'dark';

type ThemeState = {
  scheme: ThemeScheme;
  setScheme: (scheme: ThemeScheme) => void;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        scheme: 'light',
        setScheme: (scheme) => set({ scheme }),
        toggle: () => {
          const next = get().scheme === 'light' ? 'dark' : 'light';
          set({ scheme: next });
        },
      }),
      {
        name: 'pindrop-theme',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (s) => ({ scheme: s.scheme }),
      }
    )
  )
);
