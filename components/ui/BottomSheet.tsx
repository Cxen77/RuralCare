import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, StyleProp, ViewStyle, Modal } from 'react-native';
import BottomSheetLib from '@gorhom/bottom-sheet';
import type BottomSheetType from '@gorhom/bottom-sheet';
import { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Colors, Spacing } from '../../constants/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  snapPoints: (string | number)[];
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  snapPoints,
  children,
  contentStyle,
}) => {
  const sheetRef = useRef<BottomSheetType>(null);

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose]
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    []
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BottomSheetLib
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        onChange={handleChange}
        enablePanDownToClose
        enableContentPanningGesture
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView style={[styles.content, contentStyle]}>{children}</BottomSheetView>
      </BottomSheetLib>
    </Modal>
  );
};

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: Colors.outlineVariant,
    width: 44,
    height: 4,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
});
