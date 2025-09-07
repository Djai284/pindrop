import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAutoGrowTextInput } from '@/lib/hooks/useAutoGrowTextInput';
import { Text } from '@/components/ui/Text';
import { useThemeStore } from '@/lib/store/theme';

export type CommentInputProps = {
  value: string;
  onChangeText: (t: string) => void;
  onSend: (text: string) => void;
  placeholder?: string;
  maxLength?: number; // default 1000
  autoFocus?: boolean;
  inputAccessoryViewID?: string; // iOS: pass when InputAccessoryView is rendered by parent
  disabled?: boolean;
  leftIcons?: React.ReactNode; // optional placeholders
  keyboardAppearance?: TextInputProps['keyboardAppearance'];
  onFocus?: () => void;
  onHeightChange?: (h: number) => void;
};

export default function CommentInput({
  value,
  onChangeText,
  onSend,
  placeholder = 'Add a comment…',
  maxLength = 1000,
  autoFocus,
  inputAccessoryViewID,
  disabled,
  leftIcons,
  keyboardAppearance,
  onFocus,
  onHeightChange,
}: CommentInputProps) {
  const { inputHeight, onContentSizeChange, scrollEnabled } = useAutoGrowTextInput({
    minHeight: 48,
    maxHeight: 140,
  });
  const insets = useSafeAreaInsets();
  const { scheme } = useThemeStore();
  const isDark = scheme === 'dark';

  const canSend = !disabled && value.trim().length > 0;

  const placeholderColor = isDark ? '#6b7280' : '#9ca3af';
  const containerStyle = [
    styles.container,
    isDark ? styles.containerDark : styles.containerLight,
  ];
  const inputStyle = [
    styles.input,
    { height: inputHeight },
    isDark ? styles.inputDark : styles.inputLight,
  ];
  const sendBtnStyle = [styles.sendBtn, !canSend && { opacity: 0.35 }];

  const leftIconsNode = leftIcons == null
    ? null
    : (
      <View style={styles.leftIcons}>
        {typeof leftIcons === 'string' || typeof leftIcons === 'number' ? (
          <Text>{String(leftIcons)}</Text>
        ) : (
          leftIcons
        )}
      </View>
    );

  return (
    <View
      style={[styles.wrapper, { paddingBottom: Math.max(8, insets.bottom || 8) }]}
      onLayout={(e) => onHeightChange?.(Math.round(e.nativeEvent.layout.height))}
    >
      <View style={containerStyle}>
        {leftIconsNode}
        <TextInput
          style={inputStyle}
          multiline
          autoFocus={autoFocus}
          onChangeText={onChangeText}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          maxLength={maxLength}
          textAlignVertical="top"
          scrollEnabled={scrollEnabled}
          onContentSizeChange={onContentSizeChange}
          inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryViewID : undefined}
          keyboardAppearance={keyboardAppearance}
          accessibilityLabel="Add a comment"
          accessibilityHint="Double tap to type your comment"
          returnKeyType="send"
          onSubmitEditing={() => {
            if (canSend) onSend(value.trim());
          }}
          blurOnSubmit={false}
          onFocus={onFocus}
        />
        <View style={styles.rightColumn}>
          <Pressable
            onPress={() => canSend && onSend(value.trim())}
            accessibilityRole="button"
            accessibilityLabel="Send comment"
            hitSlop={10}
            style={sendBtnStyle}
            disabled={!canSend}
          >
            <Text style={styles.sendLabel}>Send</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  containerLight: { backgroundColor: '#ffffff', borderColor: '#e5e7eb' },
  containerDark: { backgroundColor: '#0b0f15', borderColor: '#374151' },
  leftIcons: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inputLight: { color: '#111827' },
  inputDark: { color: '#f9fafb' },
  rightColumn: { alignItems: 'flex-end', justifyContent: 'center', paddingVertical: 4 },
  sendBtn: {
    minWidth: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#111827',
  },
  sendLabel: { color: '#fff', fontWeight: '600' },
  
});
