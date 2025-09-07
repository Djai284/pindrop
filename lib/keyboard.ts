import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';

export function useKeyboard() {
  const [height, setHeight] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      setShown(true);
      setHeight(e.endCoordinates?.height ?? 0);
    };
    const onHide = () => {
      setShown(false);
      setHeight(0);
    };

    const subs = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  return { height, shown } as const;
}

export function getEffectiveBottomPadding(safeAreaBottom: number, keyboardHeight: number) {
  // When the keyboard is open, prefer keyboard height; otherwise safe area
  return Math.max(safeAreaBottom, keyboardHeight);
}
