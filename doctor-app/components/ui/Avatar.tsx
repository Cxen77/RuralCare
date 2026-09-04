import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

interface AvatarProps {
  uri?: string;
  name?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  online?: boolean;
  borderColor?: string;
  bgColor?: string;
  iconColor?: string;
}

const AVATAR_PALETTES = [
  { bg: '#EFFDFF', fg: Colors.primary, border: '#B5F1F8' },
  { bg: '#EEF2FF', fg: '#4F46E5', border: '#C7D2FE' },
  { bg: '#F0FDF4', fg: '#16A34A', border: '#BBF7D0' },
  { bg: '#FFF7ED', fg: '#EA580C', border: '#FFEDD5' },
  { bg: '#FAF5FF', fg: '#9333EA', border: '#E9D5FF' },
  { bg: '#ECFEFF', fg: '#0891B2', border: '#A5F3FC' },
];

const getPaletteForName = (name?: string) => {
  if (!name) return AVATAR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
};

const initialsOf = (name?: string): string => {
  if (!name) return '';
  const cleaned = name.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Shri|Smt\.)\s+/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  icon = 'person',
  size = 42,
  online = false,
  borderColor,
  bgColor,
  iconColor,
}) => {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(uri) && !imgError;
  const initials = initialsOf(name);
  const palette = getPaletteForName(name);

  const effectiveBg = bgColor || palette.bg;
  const effectiveFg = iconColor || palette.fg;
  const effectiveBorder = borderColor || palette.border;

  return (
    <View style={{ width: size, height: size }}>
      {showImage ? (
        <Image
          source={{ uri }}
          onError={() => setImgError(true)}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: effectiveBorder,
            },
          ]}
        />
      ) : initials ? (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: effectiveBorder,
              backgroundColor: effectiveBg,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize: Math.max(10, size * 0.38), color: effectiveFg }]}>
            {initials}
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: effectiveBorder,
              backgroundColor: effectiveBg,
            },
          ]}
        >
          <MaterialIcons name={icon} size={size * 0.55} color={effectiveFg} />
        </View>
      )}
      {online && (
        <View style={[styles.onlineBadge, { borderWidth: Math.max(1.5, size * 0.05) }]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    borderWidth: 1.5,
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  initials: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderColor: Colors.white,
  },
});
