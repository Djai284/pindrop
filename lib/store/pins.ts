import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Pin, PinSchema, Coords, Privacy } from '@/lib/types/pin';

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type PinsState = {
  pins: Pin[];
  addPin: (input: Partial<Pin> & { coords: Coords }) => Pin;
  updatePin: (id: string, changes: Partial<Omit<Pin, 'id'>>) => void;
  removePin: (id: string) => void;
  getPin: (id: string) => Pin | undefined;
  clear: () => void;
};

export const usePinsStore = create<PinsState>()(
  subscribeWithSelector((set, get) => ({
    pins: [],
    addPin: (input) => {
      const candidate = {
        id: input.id ?? genId(),
        title: input.title ?? 'Untitled Pin',
        description: input.description ?? '',
        photos: input.photos ?? [],
        coords: input.coords,
        privacy: (input.privacy as Privacy) ?? 'private',
        createdAt: input.createdAt ?? Date.now(),
      };
      const parsed = PinSchema.parse(candidate);
      set((state) => ({ pins: [parsed, ...state.pins] }));
      return parsed;
    },
    updatePin: (id, changes) =>
      set((state) => ({
        pins: state.pins.map((p) => (p.id === id ? { ...p, ...changes } : p)),
      })),
    removePin: (id) => set((state) => ({ pins: state.pins.filter((p) => p.id !== id) })),
    getPin: (id) => get().pins.find((p) => p.id === id),
    clear: () => set({ pins: [] }),
  }))
);
