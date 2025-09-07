import React, { useMemo } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { View } from 'react-native';

export type SheetProps = {
  children?: React.ReactNode;
  snapPoints?: (string | number)[];
  open?: boolean;
  onChange?: (index: number) => void;
};

export const Sheet = React.forwardRef<BottomSheetModal, SheetProps>(
  ({ children, snapPoints = ['25%', '50%', '90%'], onChange }, ref) => {
    const points = useMemo(() => snapPoints, [snapPoints]);
    return (
      <BottomSheetModal ref={ref} snapPoints={points} onChange={onChange}>
        <View className="px-4 py-2">{children}</View>
      </BottomSheetModal>
    );
  }
);
Sheet.displayName = 'Sheet';

export default Sheet;
