import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenType } from '../types';
import { colors } from '../theme';
import { Icon } from './Icon';

type Props = {
  current: ScreenType;
  hasActiveRide: boolean;
  onNavigate: (screen: ScreenType) => void;
  onProfile: () => void;
};

export function BottomNavBar({ current, hasActiveRide, onNavigate, onProfile }: Props) {
  const insets = useSafeAreaInsets();

  const Tab = ({ icon, label, screen, onPress, dot }: { icon: string; label: string; screen?: ScreenType; onPress?: () => void; dot?: boolean }) => {
    const active = screen === current;
    return (
      <Pressable
        onPress={onPress ?? (() => screen && onNavigate(screen))}
        style={[styles.tab, active && styles.tabActive]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon name={icon} size={22} color={active ? colors.primary : colors.onSurfaceVariant} />
        <Text style={[styles.label, active && { color: colors.primary, fontWeight: '800' }]}>{label}</Text>
        {dot && <View style={styles.dot} />}
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Tab icon="home" label="Home" screen="home" />
      <Tab icon="history" label="History" screen="ride_history" />
      <Pressable onPress={() => onNavigate('scan')} style={styles.scanWrap} accessibilityLabel="Scan QR code to ride">
        <View style={styles.scanBtn}>
          <Icon name="qr_code_scanner" size={28} color="#fff" />
        </View>
        <Text style={[styles.label, { color: colors.primary, fontWeight: '800' }]}>Scan</Text>
      </Pressable>
      <Tab icon="pedal_bike" label="Ride" screen="active_ride" dot={hasActiveRide} />
      <Tab icon="person" label="Profile" onPress={onProfile} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingTop: 6,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(247,249,253,0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(189,203,226,0.5)',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  tab: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, minWidth: 58 },
  tabActive: { backgroundColor: colors.secondaryContainer },
  label: { fontSize: 10, marginTop: 2, color: colors.onSurfaceVariant, fontWeight: '600' },
  scanWrap: { alignItems: 'center', marginTop: -22 },
  scanBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
});
