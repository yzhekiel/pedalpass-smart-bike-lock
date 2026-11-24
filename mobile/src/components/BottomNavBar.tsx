import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenType } from '../types';
import { colors, shadow } from '../theme';
import { Icon } from './Icon';

type Props = {
  current: ScreenType;
  onNavigate: (screen: ScreenType) => void;
};

/** Floating white pill: the current tab is blue and Scan remains the gold main action. */
export function BottomNavBar({ current, onNavigate }: Props) {
  const insets = useSafeAreaInsets();

  const Tab = ({ icon, label, screen }: { icon: string; label: string; screen: ScreenType }) => {
    const active = screen === current;
    return (
      <Pressable
        onPress={() => onNavigate(screen)}
        style={[styles.tab, active && styles.tabActive]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
      >
        <Icon name={icon} size={23} color={active ? '#fff' : colors.onSurfaceVariant} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 6 }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <Tab icon="home" label="Home" screen="home" />
        <Pressable
          onPress={() => onNavigate('scan')}
          style={[styles.scan, current === 'scan' && { backgroundColor: colors.ink }]}
          accessibilityRole="button"
          accessibilityLabel="Scan QR code to ride"
        >
          <Icon name="qr_code_scanner" size={26} color={current === 'scan' ? '#fff' : colors.onGold} />
        </Pressable>
        <Tab icon="person" label="Profile" screen="profile" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  bar: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    ...shadow,
    shadowOpacity: 0.14,
    elevation: 10,
  },
  tab: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.primaryFill },
  scan: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
