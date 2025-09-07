import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';
import MOCK_USERS from '@/lib/mock/users';
import { useProfileStore } from '@/lib/store/profile';

export type SocialState = {
  users: { username: string; displayName: string; bio?: string }[];
  following: string[]; // usernames you (me) follow
  followers: Record<string, string[]>; // username -> followers usernames
  follow: (username: string) => void;
  unfollow: (username: string) => void;
  isFollowing: (username: string) => boolean;
  followerCount: (username: string) => number;
  followingCount: (username?: string) => number; // default me
  getFollowers: (username: string) => string[];
  getFollowing: (username?: string) => string[]; // default me
  me: () => { username: string };
};

export const useSocialStore = create<SocialState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        users: MOCK_USERS.map((u) => ({ username: u.username, displayName: u.displayName, bio: u.bio })),
        following: [],
        followers: {},
        // helpers
        followerCount: (username: string) => (get().followers[username] || []).length,
        followingCount: (username?: string) => {
          const target = username || get().me().username;
          if (target === get().me().username) return (get().following || []).length;
          // For other users, approximate by counting anyone who lists target in their following if we had global state.
          // In this local simulation, fall back to followers map by inverse is not available; use followers map if populated by follow/unfollow.
          return (get().followers[target] || []).length; // Not precise but consistent for demo
        },
        getFollowers: (username: string) => [...(get().followers[username] || [])],
        getFollowing: (username?: string) => {
          const target = username || get().me().username;
          if (target === get().me().username) return [...(get().following || [])];
          // For other users, we don't track their following list; return []
          return [];
        },
        follow: (username) => {
          const me = get().me().username;
          if (!username || username === me) return;
          set((s) => {
            const following = Array.from(new Set([...(s.following || []), username]));
            const followers = { ...(s.followers || {}) };
            const list = new Set([...(followers[username] || []), me]);
            followers[username] = Array.from(list);
            return { following, followers };
          });
        },
        unfollow: (username) => set((s) => {
          const following = (s.following || []).filter((u) => u !== username);
          const followers = { ...(s.followers || {}) };
          if (followers[username]) followers[username] = followers[username].filter((u) => u !== get().me().username);
          return { following, followers };
        }),
        isFollowing: (username) => (get().following || []).includes(username),
        me: () => ({ username: useProfileStore.getState().username }),
      }),
      {
        name: 'pindrop-social',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (s) => ({ following: s.following, followers: s.followers }),
      }
    )
  )
);
