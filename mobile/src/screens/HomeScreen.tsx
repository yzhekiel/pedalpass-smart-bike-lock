import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BicycleItem, ScreenType, UserProfile } from '../types';
import { BICYCLES } from '../data/mockData';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Divider, IconButton, KeyValue, Row, Screen, SectionTitle, Sheet, StatTile, T } from '../components/ui';

type Props = {
  user: UserProfile;
  onNavigate: (screen: ScreenType) => void;
  activeBike: BicycleItem | null;
};

const RECENT = [
  { bike: 'BP-001', route: 'Main Gate Bay 01 ➔ Library Plaza Bay 04', time: 'Today • 08:14 AM - 08:32 AM (18 mins)' },
  { bike: 'BP-012', route: 'Science Quad Hub ➔ Admin Circle', time: 'Yesterday • 02:40 PM - 02:54 PM (14 mins)' },
];

export function HomeScreen({ user, onNavigate, activeBike }: Props) {
  const [receipt, setReceipt] = useState<string | null>(null);
  const isFaculty = user.role === 'faculty';
  const available = BICYCLES.filter((b) => b.status === 'available').length;
  const firstName = isFaculty ? user.name.split(',')[0] : user.name.split(' ')[0];
  const initials = user.name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !w.endsWith('.'))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const shortcuts = [
    { icon: 'qr_code_scanner', title: 'Scan QR', sub: 'Instant Unlock', color: colors.primary, to: 'scan' as ScreenType },
    { icon: 'directions_bike', title: 'Active Ride', sub: 'Live Session', color: colors.tertiary, to: 'active_ride' as ScreenType },
    { icon: 'receipt_long', title: 'Ride History', sub: 'Receipts', color: colors.secondary, to: 'ride_history' as ScreenType },
    { icon: 'report_problem', title: 'Report Issue', sub: 'Maintenance', color: colors.error, to: 'report_issue' as ScreenType },
  ];

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Row gap={10} style={{ flex: 1 }}>
            <View>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center' }]}>
                  <T variant="h3" style={{ color: colors.primary }}>
                    {initials}
                  </T>
                </View>
              )}
              <View style={styles.verified}>
                <Icon name="check" size={9} color="#fff" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="tiny" style={{ fontWeight: '800', color: colors.primary }} numberOfLines={1}>
                {isFaculty ? 'FACULTY & STAFF' : `STUDENT • ${user.studentId ?? ''}`}
              </T>
              <T variant="h3" numberOfLines={1} style={{ fontSize: 15 }}>
                {user.name}
              </T>
              <T variant="tiny" numberOfLines={1}>
                {user.department || user.course || "Dr. Yanga's Colleges, Inc."}
              </T>
            </View>
          </Row>
          <Row gap={4}>
            <IconButton
              icon="notifications"
              dot
              label="Campus alerts"
              onPress={() => Alert.alert('Campus Alerts', 'No new emergency campus alerts at this time.')}
            />
            <IconButton
              icon="qr_code_scanner"
              bg={colors.primaryContainer}
              color="#fff"
              label="Quick scan"
              onPress={() => onNavigate('scan')}
            />
          </Row>
        </View>
      }
    >
      {/* Greeting */}
      <Card style={{ gap: 6 }}>
        <Row gap={6}>
          <View style={styles.pulse} />
          <T variant="tiny" style={{ fontWeight: '800', color: colors.primary }}>
            Bocaue Campus Transit Network Active
          </T>
        </Row>
        <T variant="h2">Good day, {firstName}!</T>
        <T variant="small" style={{ color: colors.onSurfaceVariant }}>
          All campus bicycle bays and smart locks are operating normally.
        </T>
        <Badge label="Cleared to Ride" icon="verified" />
      </Card>

      {/* Metrics */}
      <View style={styles.grid}>
        <StatTile label="Available Bikes" value={available} sub="Across 4 hubs" icon="pedal_bike" valueColor={colors.primary} />
        <StatTile
          label="My Active Ride"
          value={activeBike ? '1 Active' : '0'}
          valueColor={activeBike ? colors.primary : colors.onSurfaceVariant}
          sub={activeBike ? `${activeBike.id} in transit` : 'Ready to ride'}
          icon="timelapse"
          iconColor={colors.tertiary}
          onPress={() => onNavigate('active_ride')}
        />
        <StatTile label="Total Rides" value={25} sub="This semester" icon="history" iconColor={colors.secondary} />
        <StatTile label="Total Usage" value="10h 20m" sub="~0.41 kg CO₂ saved" icon="timer" />
      </View>

      {/* Scan CTA */}
      <LinearGradient
        colors={[colors.primary, '#00855d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cta}
      >
        <Icon name="pedal_bike" size={130} color="rgba(255,255,255,0.1)" style={styles.ctaBg} />
        <Badge label="CAMPUS MICRO-MOBILITY" />
        <T variant="h2" style={{ color: '#fff' }}>
          Scan QR to Ride
        </T>
        <T variant="small" style={{ color: colors.onPrimaryContainer }}>
          Go to any DYCI bicycle bay and point your camera at the QR code on the smart lock to unlock it.
        </T>
        <Button
          label="Scan Bicycle QR"
          icon="qr_code_scanner"
          variant="light"
          onPress={() => onNavigate('scan')}
          style={{ alignSelf: 'flex-start', marginTop: 6 }}
        />
      </LinearGradient>

      {/* Shortcuts */}
      <T variant="tiny" style={{ fontWeight: '800', color: colors.onSurface, letterSpacing: 0.6 }}>
        SHORTCUTS
      </T>
      <View style={styles.grid}>
        {shortcuts.map((s) => (
          <Pressable key={s.title} onPress={() => onNavigate(s.to)} style={[styles.shortcut]}>
            <View style={[styles.shortcutIcon, { backgroundColor: s.color + '1A' }]}>
              <Icon name={s.icon} size={22} color={s.color} />
            </View>
            <T variant="small" style={{ fontWeight: '800' }}>
              {s.title}
            </T>
            <T variant="tiny">{s.sub}</T>
          </Pressable>
        ))}
      </View>

      {/* Bulletin */}
      <Card style={{ gap: 8 }}>
        <SectionTitle icon="campaign" right={<T variant="tiny">Sept 15, 2026</T>}>
          Campus Mobility Bulletin
        </SectionTitle>
        <View style={styles.inner}>
          <T variant="small" style={{ fontWeight: '700' }}>
            Gym Hub Bay 02 is undergoing smart lock recalibration.
          </T>
          <T variant="tiny" style={{ marginTop: 4 }}>
            Please dock at Bays 01, 03, or 04 near the athletics complex. Security personnel will assist if needed.
          </T>
        </View>
      </Card>

      {/* Recent activity */}
      <Card style={{ gap: 10 }}>
        <SectionTitle
          icon="schedule"
          right={
            <Pressable onPress={() => onNavigate('ride_history')}>
              <T variant="small" style={{ color: colors.primary, fontWeight: '800' }}>
                View all
              </T>
            </Pressable>
          }
        >
          Recent Rides
        </SectionTitle>
        {RECENT.map((r) => (
          <Row key={r.bike} style={styles.inner} gap={10}>
            <View style={styles.bikeTag}>
              <T variant="tiny" style={{ fontWeight: '800', color: colors.primary }}>
                {r.bike}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="small" style={{ fontWeight: '700' }}>
                {r.route}
              </T>
              <T variant="tiny">{r.time}</T>
            </View>
            <Button label="Receipt" small variant="outline" onPress={() => setReceipt(r.bike)} />
          </Row>
        ))}
      </Card>

      <Sheet visible={!!receipt} onClose={() => setReceipt(null)}>
        <Row gap={8}>
          <Icon name="receipt" size={22} color={colors.primary} />
          <T variant="h3">PedalPass Ride Receipt</T>
        </Row>
        <Divider />
        <View style={{ gap: 8 }}>
          <KeyValue k="Session ID" v="SESS-2026-9218" />
          <KeyValue k="Bicycle" v={`${receipt} (Campus Cruiser)`} vStyle={{ color: colors.primary }} />
          <KeyValue k="Rider" v={user.name} />
          <KeyValue k="From" v="Main Gate Bay 01" />
          <KeyValue k="To" v="Library Plaza Bay 04" />
          <Divider />
          <KeyValue k="Carbon saved" v="0.14 kg CO₂" vStyle={{ color: colors.success }} />
        </View>
        <Button label="Close" onPress={() => setReceipt(null)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surfaceContainer },
  verified: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cta: { borderRadius: radius.lg, padding: 18, gap: 6, overflow: 'hidden' },
  ctaBg: { position: 'absolute', right: -14, bottom: -24 },
  shortcut: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(189,203,226,0.6)',
    backgroundColor: colors.surfaceContainerLowest,
  },
  shortcutIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  inner: {
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(189,203,226,0.4)',
  },
  bikeTag: {
    width: 52,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.gold + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
