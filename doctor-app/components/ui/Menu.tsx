import React from 'react';
import { StyleSheet } from 'react-native';
import { Menu as PaperMenu } from 'react-native-paper';
import type { ComponentProps } from 'react';
import { Colors, Radii, Spacing } from '../../constants/theme';

type MenuItemProps = ComponentProps<typeof PaperMenu.Item>;

interface AppMenuItemProps extends MenuItemProps {
  danger?: boolean;
}

export const AppMenu: React.FC<ComponentProps<typeof PaperMenu>> = ({ contentStyle, style, ...rest }) => (
  <PaperMenu
    {...rest}
    style={style}
    contentStyle={[styles.content, contentStyle]}
  />
);

export const AppMenuItem: React.FC<AppMenuItemProps> = ({ titleStyle, danger = false, ...rest }) => (
  <PaperMenu.Item
    {...rest}
    titleStyle={[styles.title, danger && styles.titleDanger, titleStyle]}
    contentStyle={[styles.itemContent]}
  />
);

const styles = StyleSheet.create({
  content: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    paddingVertical: Spacing.xs,
  },
  itemContent: {
    paddingHorizontal: Spacing.sm,
    minHeight: 44,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurface,
    maxHeight: 44,
  },
  titleDanger: {
    color: Colors.error,
  },
});
