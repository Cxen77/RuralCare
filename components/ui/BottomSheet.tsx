import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, StyleProp, ViewStyle, Modal, Platform, View, TouchableWithoutFeedback } from 'react-native';
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

  if (Platform.OS === 'web') {
    const rawSnap = snapPoints?.[0] ?? '92%';
    const heightVal = typeof rawSnap === 'number' ? `${rawSnap}px` : rawSnap;
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.webOverlay}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.webBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.webSheet, { height: heightVal as any, maxHeight: heightVal as any }]}>
            <View style={styles.handleContainer}>
              <View style={styles.handleIndicator} />
            </View>
            <View style={[styles.content, contentStyle]}>{children}</View>
          </View>
        </View>
      </Modal>
    );
  }

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
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleIndicator: {
    backgroundColor: Colors.outlineVariant,
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
    paddingTop: Spacing.xs,
    overflow: 'hidden',
  },
  webOverlay: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  webBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  webSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
});
