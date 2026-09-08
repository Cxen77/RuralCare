import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '../constants/theme';

export type TabType = 'home' | 'triage' | 'doctors' | 'map' | 'meds' | 'profile';

interface BottomTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: TabType; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'triage', label: 'Triage', icon: 'medical-services' },
    { id: 'doctors', label: 'Doctors', icon: 'person-search' },
    { id: 'meds', label: 'Meds', icon: 'medication' },
    { id: 'profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabItem}
            onPress={() => onTabChange(tab.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <MaterialIcons
                name={tab.icon}
                size={22}
                color={isActive ? Colors.primary : Colors.onSurfaceVariant}
              />
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 68,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineLight,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4,
    ...Shadows.md,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 42,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: Colors.primaryLight,
  },
  tabLabel: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
    marginTop: 2,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
