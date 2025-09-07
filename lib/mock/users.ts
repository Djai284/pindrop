import type { Category, Pin } from '@/lib/types/pin';

export type MockUser = {
  username: string;
  displayName: string;
  bio?: string;
  // Pins authored by this user
  pins: Array<Partial<Pin> & { coords: { latitude: number; longitude: number } } & { owner?: string }>;
};

const now = Date.now();
const days = (n: number) => now - n * 86400000;

// Fallback inline users
const fallbackUsers: MockUser[] = [
  {
    username: 'alex',
    displayName: 'Alex Kim',
    bio: 'Coffee and city walks.',
    pins: [
      { id: 'alex-1', title: 'Blue Bottle Hayes', description: 'Best pour-over.', categories: ['cafe'] as Category[], privacy: 'public', createdAt: days(1), coords: { latitude: 37.7763, longitude: -122.4231 } },
      { id: 'alex-2', title: 'Study nook @ Library', description: 'Quiet weekday mornings', categories: ['study'] as Category[], privacy: 'friends', createdAt: days(5), coords: { latitude: 37.7793, longitude: -122.4155 } },
    ],
  },
  {
    username: 'sam',
    displayName: 'Sam Patel',
    bio: 'Hiking and matcha.',
    pins: [
      { id: 'sam-1', title: 'Lands End lookout', categories: ['nature'] as Category[], privacy: 'public', createdAt: days(2), coords: { latitude: 37.7802, longitude: -122.513 } },
      { id: 'sam-2', title: 'Secret matcha spot', categories: ['cafe'] as Category[], privacy: 'friends', createdAt: days(12), coords: { latitude: 37.7922, longitude: -122.407 } },
    ],
  },
  {
    username: 'taylor',
    displayName: 'Taylor Rowe',
    bio: 'Art & galleries',
    pins: [
      { id: 'taylor-1', title: 'Local mural', categories: ['art'] as Category[], privacy: 'public', createdAt: days(7), coords: { latitude: 37.7602, longitude: -122.414 } },
      { id: 'taylor-2', title: 'Studio hang', categories: ['art'] as Category[], privacy: 'private', createdAt: days(8), coords: { latitude: 37.7569, longitude: -122.42 } },
    ],
  },
  {
    username: 'jordan',
    displayName: 'Jordan Lee',
    bio: 'Nature escapes on weekends',
    pins: [
      { id: 'jordan-1', title: 'Twin Peaks sunset', categories: ['landmark'] as Category[], privacy: 'public', createdAt: days(3), coords: { latitude: 37.7544, longitude: -122.4477 } },
    ],
  },
  {
    username: 'casey',
    displayName: 'Casey Nguyen',
    bio: 'Cafes and co-working',
    pins: [
      { id: 'casey-1', title: 'Neighborhood roasters', categories: ['cafe'] as Category[], privacy: 'friends', createdAt: days(4), coords: { latitude: 37.7707, longitude: -122.441 } },
    ],
  },
];

function coerceUsers(input: any): MockUser[] | null {
  try {
    const arr = (input?.users as any[]) || null;
    if (!arr) return null;
    return arr.map((u) => ({
      username: String(u.username),
      displayName: String(u.displayName || u.username),
      bio: u.bio ? String(u.bio) : undefined,
      pins: ((u.pins as any[]) || []).map((p) => ({
        id: p.id ? String(p.id) : undefined,
        title: p.title ? String(p.title) : undefined,
        description: p.description ? String(p.description) : undefined,
        categories: Array.isArray(p.categories) ? (p.categories as Category[]) : undefined,
        privacy: p.privacy || 'public',
        createdAt: p.createdAt ? Number(p.createdAt) : undefined,
        coords: { latitude: Number(p.coords.latitude), longitude: Number(p.coords.longitude) },
        owner: u.username,
      })),
    }));
  } catch {
    return null;
  }
}

let source: MockUser[] | null = null;
try {
  // Metro supports JSON requires
  const usersJson = require('./users.json');
  source = coerceUsers(usersJson);
} catch {}

const baseUsers: MockUser[] = (source && Array.isArray(source) ? source : fallbackUsers) as MockUser[];

export const MOCK_USERS: MockUser[] = baseUsers.map((u) => ({
  ...u,
  pins: u.pins.map((p) => ({ ...p, owner: p.owner || u.username })),
}));

export default MOCK_USERS;
