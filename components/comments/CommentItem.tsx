import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useThemeStore } from '@/lib/store/theme';

export type CommentUser = {
  id: string;
  name: string;
  avatar?: string;
};

export type Comment = {
  id: string;
  user: CommentUser | string; // allow legacy string username
  text: string;
  createdAt: number | string; // epoch ms or ISO
  likes?: number;
};

type Props = {
  item: Comment;
  onPressUser?: (userId: string) => void;
};

export default function CommentItem({ item, onPressUser }: Props) {
  const { scheme } = useThemeStore();
  const isDark = scheme === 'dark';
  const username = typeof item.user === 'string' ? item.user : item.user.name;
  const userId = typeof item.user === 'string' ? item.user : item.user.id;

  return (
    <View style={styles.container}>
      <View style={[styles.avatar, isDark ? styles.avatarDark : styles.avatarLight]}>
        <Text style={styles.avatarText}>{username?.[0]?.toUpperCase() || '?'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => onPressUser?.(userId)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${username}'s profile`}
            hitSlop={8}
          >
            <Text weight="semibold" style={[styles.username, isDark ? styles.usernameDark : styles.usernameLight]}>
              {username}
            </Text>
          </Pressable>
          <Text style={[styles.time, isDark ? styles.timeDark : styles.timeLight]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
        <Text style={[styles.text, isDark ? styles.textDark : styles.textLight]}>{item.text}</Text>
      </View>
    </View>
  );
}

function formatTime(input: number | string) {
  const ts = typeof input === 'string' ? Date.parse(input) : Number(input);
  const diff = Date.now() - (isFinite(ts) ? ts : Date.now());
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLight: { backgroundColor: '#111827' },
  avatarDark: { backgroundColor: '#1f2937' },
  avatarText: { color: '#fff', fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  username: {},
  usernameLight: { color: '#111827' },
  usernameDark: { color: '#e5e7eb' },
  time: { fontSize: 12 },
  timeLight: { color: '#9ca3af' },
  timeDark: { color: '#6b7280' },
  text: { marginTop: 2 },
  textLight: { color: '#374151' },
  textDark: { color: '#d1d5db' },
});
