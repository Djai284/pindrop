import React, { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View, ViewToken } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useThemeStore } from '@/lib/store/theme';
import Colors from '@/constants/Colors';
import { Text } from '@/components/ui/Text';

export type ImageGalleryProps = {
  uris: string[];
  height?: number;
  pageWidth?: number; // default: screen width
  containerPaddingHorizontal?: number; // inner padding on each page, e.g. 16
  borderRadius?: number;
  showCounter?: boolean;
  showDots?: boolean;
  contentFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
};

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  uris,
  height = 220,
  pageWidth,
  containerPaddingHorizontal = 0,
  borderRadius = 12,
  showCounter = true,
  showDots = true,
  contentFit = 'cover',
}) => {
  const { scheme } = useThemeStore();
  const tint = Colors[scheme ?? 'light'].tint;
  const { width: screenW } = useWindowDimensions();
  const pageW = Math.max(1, Math.floor(pageWidth || screenW));
  const innerW = Math.max(0, pageW - 2 * containerPaddingHorizontal);

  const [index, setIndex] = useState(0);
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 60 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems?.length) {
      const i = viewableItems[0]?.index ?? 0;
      if (typeof i === 'number') setIndex(i);
    }
  });

  const renderItem = ({ item }: { item: string }) => (
    <View style={{ width: pageW, paddingHorizontal: containerPaddingHorizontal }}>
      <ExpoImage
        source={{ uri: item }}
        style={{ width: innerW, height, borderRadius, backgroundColor: scheme === 'dark' ? '#0b0f15' : '#e5e7eb' }}
        contentFit={contentFit}
        cachePolicy="memory-disk"
      />
    </View>
  );

  return (
    <View>
      <FlatList
        data={uris}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(u) => u}
        renderItem={renderItem}
        snapToInterval={pageW}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewConfig.current as any}
      />

      {/* Counter pill */}
      {showCounter && uris.length > 1 && (
        <View style={styles.counterPill} pointerEvents="none">
          <Text weight="semibold" style={{ color: '#fff' }}>
            {index + 1}/{uris.length}
          </Text>
        </View>
      )}

      {/* Dots */}
      {showDots && uris.length > 1 && (
        <View style={styles.dotsWrap} pointerEvents="none">
          {uris.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  counterPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dotsWrap: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: { backgroundColor: '#ffffff' },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.5)' },
});

export default ImageGallery;
