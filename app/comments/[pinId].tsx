import React, { useCallback, useMemo, useRef, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import CommentItem from '@/components/comments/CommentItem';
import CommentInput from '@/components/comments/CommentInput';
import { usePinsStore } from '@/lib/store/pins';
import { useThemeStore } from '@/lib/store/theme';

export default function CommentsScreen() {
  const { pinId } = useLocalSearchParams<{ pinId: string }>();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const getPin = usePinsStore((s) => s.getPin);
  const addComment = usePinsStore((s) => s.addComment);
  const { scheme } = useThemeStore();
  const isDark = scheme === 'dark';

  const [text, setText] = useState('');
  const listRef = useRef<FlashListRef<any>>(null);
  const [inputBarHeight, setInputBarHeight] = useState(56);

  const data = useMemo(() => {
    const p = pinId ? getPin(String(pinId)) : null;
    return (p?.comments ?? []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [pinId, getPin]);

  const onSend = useCallback(
    (t: string) => {
      const id = String(pinId);
      if (!id || !t.trim()) return;
      addComment(id, { user: 'You', text: t.trim() });
      setText('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    },
    [pinId, addComment]
  );

  const handleFocus = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), Platform.OS === 'ios' ? 50 : 150);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: isDark ? '#000000' : '#ffffff' }]}> 
        <Pressable
          onPress={() => (nav as any).goBack?.()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          style={styles.navBack}
        >
          <Text style={{ color: isDark ? '#e5e7eb' : '#111827' }}>Back</Text>
        </Pressable>
        <Text weight="semibold" style={[styles.headerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>Comments</Text>
        <View style={{ width: 44 }} />
      </View>

      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
        <FlashList
          ref={listRef}
          data={data}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <CommentItem item={item} />}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
          ListFooterComponent={<View style={{ height: inputBarHeight + Math.max(8, insets.bottom) }} />}
        />
      </Pressable>

      <View
        style={styles.bottom}
        onLayout={(e) => setInputBarHeight(Math.max(48, Math.round(e.nativeEvent.layout.height)))}
      >
        <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />
        <CommentInput
          value={text}
          onChangeText={setText}
          onSend={onSend}
          keyboardAppearance={Platform.OS === 'ios' ? (isDark ? 'dark' : 'light') : undefined}
          inputAccessoryViewID={Platform.OS === 'ios' ? 'commentsAccessory' : undefined}
          onFocus={handleFocus}
        />
      </View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="commentsAccessory" backgroundColor={isDark ? '#0b0f15' : '#ffffff'}>
          <View style={[styles.accessoryBar, { borderTopColor: isDark ? '#374151' : '#e5e7eb' }] }>
            <Text style={[styles.accessoryText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Quick actions</Text>
            <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" hitSlop={10}>
              <Text weight="semibold" style={{ color: isDark ? '#f9fafb' : '#111827' }}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  divider: { height: StyleSheet.hairlineWidth },
  accessoryBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accessoryText: {},
});
