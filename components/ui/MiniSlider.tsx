import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, PanResponderInstance, StyleSheet, View, ViewProps } from 'react-native';

export type MiniSliderProps = ViewProps & {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (v: number) => void;
  trackHeight?: number;
  thumbSize?: number;
};

export const MiniSlider: React.FC<MiniSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  style,
  trackHeight = 4,
  thumbSize = 20,
  ...rest
}) => {
  const [width, setWidth] = useState(0);
  const clamped = Math.max(min, Math.min(max, value));
  const pct = width > 0 ? (clamped - min) / (max - min) : 0;
  const thumbX = width * pct;

  const snap = (v: number) => {
    const steps = Math.round(v / step);
    return min + steps * step;
  };

  const responder = useRef<PanResponderInstance>(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (!onChange || width <= 0) return;
        const x = Math.max(0, Math.min(width, evt.nativeEvent.locationX));
        const next = snap(min + (x / width) * (max - min));
        onChange(Number(next.toFixed(2)));
      },
      onPanResponderMove: (evt, gesture) => {
        if (!onChange || width <= 0) return;
        // locationX not reliable in move, use dx from initial thumb position by recomputing from pageX
        const pageX = evt.nativeEvent.pageX;
        // Convert pageX to relative by subtracting element's layout X via measure? Simpler: use locationX if present
        const rel = (evt.nativeEvent as any).locationX ?? thumbX + gesture.dx;
        const x = Math.max(0, Math.min(width, rel));
        const next = snap(min + (x / width) * (max - min));
        onChange(Number(next.toFixed(2)));
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminationRequest: () => true,
    })
  ).current;

  return (
    <View
      {...rest}
      style={[styles.wrap, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      <View style={[styles.track, { height: trackHeight }]} />
      <View style={[styles.fill, { height: trackHeight, width: Math.max(thumbSize / 2, thumbX) }]} />
      <View style={[styles.thumb, { width: thumbSize, height: thumbSize, left: Math.max(0, thumbX - thumbSize / 2) }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%', justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, borderRadius: 999, backgroundColor: '#e5e7eb' },
  fill: { position: 'absolute', left: 0, borderRadius: 999, backgroundColor: '#111827' },
  thumb: { position: 'absolute', top: 0, borderRadius: 999, backgroundColor: '#111827' },
});

export default MiniSlider;
