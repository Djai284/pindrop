import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';

export type ProfileState = {
  displayName: string;
  username: string;
  bio: string;
  email: string;
  setDisplayName: (name: string) => void;
  setUsername: (username: string) => void;
  setBio: (bio: string) => void;
  setEmail: (email: string) => void;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 24) || 'me';
}

function randomSuffix(len = 4) {
  return Math.random().toString(36).slice(2, 2 + len);
}

export const useProfileStore = create<ProfileState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        displayName: 'Traveler',
        username: `traveler-${randomSuffix()}`,
        bio: '',
        email: '',
        setDisplayName: (name) => {
          set({ displayName: name });
          // If username is default-like, refresh it based on new name (one-time convenience)
          const current = get().username;
          if (/^traveler-[a-z0-9]{4}$/i.test(current)) {
            const next = slugify(name);
            if (next && next !== 'me') set({ username: `${next}-${randomSuffix()}` });
          }
        },
        setUsername: (username) => set({ username: slugify(username) || 'me' }),
        setBio: (bio) => set({ bio }),
        setEmail: (email) => set({ email }),
      }),
      {
        name: 'pindrop-profile',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (s) => ({ displayName: s.displayName, username: s.username, bio: s.bio, email: s.email }),
      }
    )
  )
);
