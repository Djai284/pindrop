import { useCallback, useMemo, useRef, useState } from 'react';
import { NativeSyntheticEvent, TextInputContentSizeChangeEventData } from 'react-native';

export function useAutoGrowTextInput(options?: { minHeight?: number; maxHeight?: number }) {
  const { minHeight = 48, maxHeight = 140 } = options || {};
  const [inputHeight, setInputHeight] = useState(minHeight);
  const contentHeightRef = useRef(minHeight);

  const onContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const h = Math.ceil(e.nativeEvent.contentSize.height);
      contentHeightRef.current = h;
      const clamped = Math.max(minHeight, Math.min(maxHeight, h));
      if (clamped !== inputHeight) setInputHeight(clamped);
    },
    [minHeight, maxHeight, inputHeight]
  );

  const scrollEnabled = useMemo(() => contentHeightRef.current > maxHeight, [maxHeight]);

  return { inputHeight, onContentSizeChange, scrollEnabled } as const;
}
