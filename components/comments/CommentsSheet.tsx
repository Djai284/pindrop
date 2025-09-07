import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CommentInput from '@/components/comments/CommentInput';
import CommentItem from '@/components/comments/CommentItem';
import { Text } from '@/components/ui/Text';
import { usePinsStore } from '@/lib/store/pins';
import { useThemeStore } from '@/lib/store/theme';

export type CommentsSheetRef = {
  presentFor: (pinId: string) => void;
  dismiss: () => void;
};

function CommentsSheetImpl(_: {}, ref: React.Ref<CommentsSheetRef>) {
  const modalRef = useRef<BottomSheetModal>(null);
  const listRef = useRef<FlashListRef<any>>(null);
  const [pinId, setPinId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const { scheme } = useThemeStore();
  const isDark = scheme === 'dark';
  const [inputBarHeight, setInputBarHeight] = useState(56);

  const getPin = usePinsStore((s) => s.getPin);
  const addComment = usePinsStore((s) => s.addComment);

  const data = useMemo(() => {
    const p = pinId ? getPin(pinId) : null;
    // Sort ascending by createdAt so newest are at end
    const arr = (p?.comments ?? []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return arr;
  }, [pinId, getPin]);

  useImperativeHandle(ref, () => ({
    presentFor: (id: string) => {
      setPinId(id);
      requestAnimationFrame(() => modalRef.current?.present());
    },
    dismiss: () => {
      modalRef.current?.dismiss();
    },
  }));

  const onSend = useCallback(
    (t: string) => {
      const id = pinId;
      if (!id || !t.trim()) return;
      addComment(id, { user: 'You', text: t.trim() });
      setText('');
      // keep keyboard open for quick follow-up
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    },
    [pinId, addComment]
  );

  const handleFocus = useCallback(() => {
    // wait for keyboard to appear then scroll to end
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), Platform.OS === 'ios' ? 50 : 150);
  }, []);

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={["60%", "90%"]}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableDynamicSizing={false}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: isDark ? '#111827' : '#ffffff' }}
      handleIndicatorStyle={{ backgroundColor: isDark ? '#4b5563' : '#9ca3af' }}
      onDismiss={() => {
        setPinId(null);
        setText('');
        Keyboard.dismiss();
      }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <BottomSheetView style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text weight="semibold" style={{ fontSize: 16, color: isDark ? '#f9fafb' : '#111827' }}>Comments</Text>
          </View>
          <FlashList
            ref={listRef}
            data={data}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => <CommentItem item={item} />}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
            ListFooterComponent={<View style={{ height: Math.max(8, insets.bottom) + inputBarHeight }} />}
            keyboardShouldPersistTaps="handled"
          />
        </BottomSheetView>
        <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />
        <CommentInput
          value={text}
          onChangeText={setText}
          onSend={onSend}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          onFocus={handleFocus}
          onHeightChange={setInputBarHeight}
        />
      </KeyboardAvoidingView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
  },
});

const CommentsSheet = forwardRef<CommentsSheetRef, {}>(CommentsSheetImpl);
export default CommentsSheet;
