import { create } from 'zustand';

export type PrivacyFilter = 'all' | 'private' | 'friends' | 'public' | 'following';

type MapUiState = {
  privacyFilter: PrivacyFilter;
  // When set, the Map screen should focus/center on this pin and open details.
  focusPinId: string | null;
  setPrivacyFilter: (v: PrivacyFilter) => void;
  setFocusPinId: (id: string | null) => void;
};

export const useMapUiStore = create<MapUiState>((set) => ({
  privacyFilter: 'all',
  focusPinId: null,
  setPrivacyFilter: (v) => set({ privacyFilter: v }),
  setFocusPinId: (id) => set({ focusPinId: id }),
}));
