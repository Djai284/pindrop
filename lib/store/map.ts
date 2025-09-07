import { create } from 'zustand';

export type PrivacyFilter = 'all' | 'private' | 'friends' | 'public' | 'following';

type MapUiState = {
  privacyFilter: PrivacyFilter;
  setPrivacyFilter: (v: PrivacyFilter) => void;
};

export const useMapUiStore = create<MapUiState>((set) => ({
  privacyFilter: 'all',
  setPrivacyFilter: (v) => set({ privacyFilter: v }),
}));
