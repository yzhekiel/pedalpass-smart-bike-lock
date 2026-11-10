import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenType } from '../types';
import { colors, shadow } from '../theme';
import { Icon } from './Icon';

type Props = {
  current: ScreenType;
  hasActiveRide: boolean;
  onNavigate: (screen: ScreenType) => void;
};

/** Floating white pill: the current tab is a dark circle, Scan (the main action) is gold in the middle. */
export function BottomNavBar({ current, hasActiveRide, onNavigate }: Props) {
  const insets = useSafeAreaInsets();

  /** `also`: other screens that belong to this tab (it stays highlighted on them) */
  const Tab = ({ icon, label, screen, also = [], dot }: { icon: string; label: string; screen: ScreenType; also?: ScreenType[]; dot?: boolean }) => {
    const active = screen === current || also.includes(current);
    return (
      <Pressable
        onPress={() => onNavigate(screen)}
        style={[styles.tab, active && styles.tabActive]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
      >
        <Icon name={icon} size={23} color={active ? '#fff' : colors.onSurfaceVariant} />
        {dot && <View style={styles.dot} />}
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 6 }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <Tab icon="home" label="Home" screen="home" />
        {/* My Rides = the ride in progress (active_ride) + past rides */}
        <Tab icon="pedal_bike" label="My rides" screen="ride_history" also={['active_ride']} dot={hasActiveRide} />
        <Pressable
          onPress={() => onNavigate('scan')}
          style={[styles.scan, current === 'scan' && { backgroundColor: colors.ink }]}
          accessibilityRole="button"
          accessibilityLabel="Scan QR code to ride"
        >
          <Icon name="qr_code_scanner" size={26} color={current === 'scan' ? '#fff' : colors.onGold} />
        </Pressable>
        <Tab icon="map" label="Campus map" screen="campus_map" />
        <Tab icon="person" label="Profile" screen="profile" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  bar: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadow,
    shadowOpacity: 0.14,
    elevation: 10,
  },
  tab: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.ink },
  scan: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surfaceContainerLowest,
  },
});
