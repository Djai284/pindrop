import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Pin, PinSchema, Coords, Privacy, Category, PinComment } from '@/lib/types/pin';
import MOCK_USERS from '@/lib/mock/users';
import * as FileSystem from 'expo-file-system';

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedFromMocks(): Pin[] {
  try {
    const all: Pin[] = [];
    for (const u of MOCK_USERS) {
      for (const p of u.pins as any[]) {
        const candidate = {
          id: p.id ?? genId(),
          title: p.title ?? 'Untitled Pin',
          description: p.description ?? '',
          photos: p.photos ?? [],
          categories: (p.categories as Category[]) ?? [],
          coords: p.coords,
          privacy: (p.privacy as Privacy) ?? 'public',
          createdAt: p.createdAt ?? Date.now(),
          owner: p.owner ?? u.username,
          comments: p.comments ?? [],
          likesCount: p.likesCount ?? 0,
          myLiked: false,
        } as any;
        const parsed = PinSchema.parse(candidate);
        all.push(parsed);
      }
    }
    // Sort by createdAt desc
    all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return all;
  } catch {
    return [];
  }
}

export type PinsState = {
  pins: Pin[];
  addPin: (input: Partial<Pin> & { coords: Coords }) => Pin;
  updatePin: (id: string, changes: Partial<Omit<Pin, 'id'>>) => void;
  removePin: (id: string) => void;
  getPin: (id: string) => Pin | undefined;
  clear: () => void;
  addComment: (id: string, input: { user: string; text: string }) => void;
  toggleLike: (id: string) => void;
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
        categories: (input.categories as Category[]) ?? [],
        coords: input.coords,
        privacy: (input.privacy as Privacy) ?? 'private',
        createdAt: input.createdAt ?? Date.now(),
        owner: (input as any).owner ?? 'me',
        comments: (input.comments as PinComment[]) ?? [],
        likesCount: input.likesCount ?? 0,
        myLiked: input.myLiked ?? false,
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
    addComment: (id, input) =>
      set((state) => ({
        pins: state.pins.map((p) => {
          if (p.id !== id) return p;
          const comment: PinComment = {
            id: genId(),
            user: input.user,
            text: input.text,
            createdAt: Date.now(),
          };
          return { ...p, comments: [comment, ...(p.comments ?? [])] };
        }),
      })),
    toggleLike: (id) =>
      set((state) => ({
        pins: state.pins.map((p) => {
          if (p.id !== id) return p;
          const liked = !!p.myLiked;
          return {
            ...p,
            myLiked: !liked,
            likesCount: Math.max(0, (p.likesCount ?? 0) + (liked ? -1 : 1)),
          };
        }),
      })),
  }))
);

// -------------------------
// Persistence (expo-file-system)
// -------------------------

const PERSIST_VERSION = 1;

function getPersistFile(): string | null {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null; // Not available on some platforms (e.g., web)
  return `${dir}pins.json`;
}

type PersistShapeV1 = {
  version: 1;
  pins: Pin[];
};

type AnyPersistShape = PersistShapeV1 & { version: number };

let unsubscribePersist: null | (() => void) = null;
let writeTimer: any = null;

async function writePins(pins: Pin[]) {
  const file = getPersistFile();
  if (!file) return; // skip on unsupported platforms
  const payload: PersistShapeV1 = { version: PERSIST_VERSION as 1, pins };
  try {
    await FileSystem.writeAsStringAsync(file, JSON.stringify(payload));
  } catch (e) {
    // noop: avoid crashing on write issues
  }
}

function scheduleWrite(pins: Pin[]) {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writePins(pins);
  }, 250);
}

function migrate(input: any): PersistShapeV1 | null {
  if (!input || typeof input !== 'object') return null;
  const version = Number(input.version ?? 0);
  // Future migrations can switch on version here
  if (version === 1 || version === PERSIST_VERSION) {
    try {
      const pins = (input.pins as any[]) || [];
      // Validate each pin through schema
      const parsedPins: Pin[] = pins
        .map((p) => {
          try {
            return PinSchema.parse(p);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Pin[];
      return { version: 1, pins: parsedPins };
    } catch {
      return { version: 1, pins: [] };
    }
  }
  // Default: best-effort parse
  try {
    const parsedPins: Pin[] = ((input.pins as any[]) || [])
      .map((p) => {
        try {
          return PinSchema.parse(p);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Pin[];
    return { version: 1, pins: parsedPins };
  } catch {
    return { version: 1, pins: [] };
  }
}

export async function initPinsPersistence() {
  const file = getPersistFile();
  if (!file) {
    // Skip persistence on unsupported platforms
    // Still seed mock data into memory when empty
    if (usePinsStore.getState().pins.length === 0) {
      const seeded = seedFromMocks();
      if (seeded.length > 0) usePinsStore.setState({ pins: seeded });
    }
    return;
  }
  // Hydrate from disk
  try {
    const info = await FileSystem.getInfoAsync(file);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(file);
      const json = JSON.parse(raw) as AnyPersistShape;
      const migrated = migrate(json);
      if (migrated) {
        usePinsStore.setState({ pins: migrated.pins });
      }
    }
  } catch {
    // ignore
  }

  // If still empty after hydration, seed mocks
  if (usePinsStore.getState().pins.length === 0) {
    const seeded = seedFromMocks();
    if (seeded.length > 0) usePinsStore.setState({ pins: seeded });
  }

  // Subscribe once to persist changes
  if (!unsubscribePersist) {
    unsubscribePersist = usePinsStore.subscribe(
      (s) => s.pins,
      (pins) => scheduleWrite(pins)
    );
  }
}
