import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';

export type DoctorTab = 'today' | 'patients' | 'consult' | 'rx' | 'profile';

interface BottomTabBarProps {
  activeTab: DoctorTab;
  onTabChange: (tab: DoctorTab) => void;
}

const TABS: { id: DoctorTab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'today', label: 'Today', icon: 'dashboard' },
  { id: 'patients', label: 'Patients', icon: 'people' },
  { id: 'rx', label: 'Rx', icon: 'receipt-long' },
  { id: 'profile', label: 'Profile', icon: 'person' },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.id || (tab.id === 'patients' && activeTab === 'consult');
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
