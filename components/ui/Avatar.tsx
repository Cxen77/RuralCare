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

const initialsOf = (name?: string) =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  icon = 'person',
  size = 42,
  online = false,
  borderColor = Colors.primaryFixedDim,
  bgColor = Colors.primaryLight,
  iconColor = Colors.primary,
}) => {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(uri) && !imgError;
  const initials = name ? initialsOf(name) : undefined;

  return (
    <View style={{ width: size, height: size }}>
      {showImage ? (
        <Image
          source={{ uri }}
          onError={() => setImgError(true)}
          style={[
            styles.image,
            { width: size, height: size, borderRadius: size / 2, borderColor },
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
              borderColor,
              backgroundColor: bgColor,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.38, color: iconColor }]}>
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
              borderColor,
              backgroundColor: bgColor,
            },
          ]}
        >
          <MaterialIcons name={icon} size={size * 0.58} color={iconColor} />
        </View>
      )}
      {online && (
        <View style={[styles.onlineBadge, { borderWidth: Math.max(2, size * 0.05) }]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    borderWidth: 2,
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  initials: {
    fontWeight: '700',
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
