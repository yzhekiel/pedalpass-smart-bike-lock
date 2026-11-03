import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BicycleItem, RideRecord, ScreenType, UserProfile } from '../types';
import { colors, radius, shadow } from '../theme';
import { Icon } from '../components/Icon';
import { Button, Card, Divider, IconButton, KeyValue, Row, Screen, Sheet, T, Tile } from '../components/ui';
import { isReady } from '../services/rideService';

type Props = {
  user: UserProfile;
  bikes: BicycleItem[];
  rides: RideRecord[];
  onNavigate: (screen: ScreenType) => void;
  activeBike: BicycleItem | null;
};

// The only PedalPass station (see supabase/migrations/006_covered_court_station.sql)
const STATION = 'Covered Court Hub';

export function HomeScreen({ user, bikes, rides, onNavigate, activeBike }: Props) {
  const [receipt, setReceipt] = useState<RideRecord | null>(null);
  const totalMin = rides.reduce((sum, r) => sum + r.durationMin, 0);
  const usage = totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`;
  const isFaculty = user.memberType === 'faculty';
  const ready = bikes.filter(isReady);
  const firstName = isFaculty ? user.name.split(',')[0] : user.name.split(' ')[0];
  const initials = user.name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !w.endsWith('.'))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const actions: { icon: string; label: string; to: ScreenType; highlight?: boolean }[] = [
    { icon: 'qr_code_scanner', label: 'Scan', to: 'scan', highlight: true },
    { icon: 'map', label: 'Map', to: 'campus_map' },
    { icon: 'history', label: 'History', to: 'ride_history' },
    { icon: 'report_problem', label: 'Report', to: 'report_issue' },
    { icon: 'person', label: 'Profile', to: 'profile' },
  ];

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Row gap={12} style={{ flex: 1 }}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <T variant="h3" style={{ color: colors.primary }}>
                  {initials}
                </T>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <T variant="h2">Welcome!</T>
              <T variant="tiny" numberOfLines={1}>
                {isFaculty ? 'Faculty & staff' : `Student${user.studentId ? ` • ${user.studentId}` : ''}`} • ready to ride, {firstName}?
              </T>
            </View>
          </Row>
          <IconButton
            icon="notifications"
            label="Campus alerts"
            onPress={() => Alert.alert('Campus Alerts', 'No new emergency campus alerts at this time.')}
          />
        </View>
      }
    >
      {/* Station status pill */}
      <Pressable onPress={() => onNavigate('campus_map')} style={styles.pill} accessibilityRole="button" accessibilityLabel="Open campus map">
        <Icon name="location_on" size={20} color={colors.primary} />
        <T variant="small" style={{ flex: 1, color: colors.onSurfaceVariant }} numberOfLines={1}>
          <T variant="small" style={{ fontWeight: '800', color: colors.onSurface }}>
            {ready.length} {ready.length === 1 ? 'bike' : 'bikes'} ready
          </T>{' '}
          at {STATION}
        </T>
        <Icon name="chevron_right" size={20} color={colors.outline} />
      </Pressable>

      {/* Quick actions */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles} style={styles.tilesWrap}>
        {actions.map((a) => (
          <Tile key={a.label} icon={a.icon} label={a.label} highlight={a.highlight} onPress={() => onNavigate(a.to)} />
        ))}
      </ScrollView>

      {/* Ride in progress */}
      {activeBike && (
        <Card style={styles.riding}>
          <View style={styles.ridingIcon}>
            <Icon name="pedal_bike" size={24} color={colors.onGold} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="h3" style={{ color: '#fff' }}>
              Riding {activeBike.id}
            </T>
            <T variant="tiny" style={{ color: colors.onPrimaryContainer }}>
              Return it to {STATION} when you're done
            </T>
          </View>
          <Button label="Open" small variant="accent" onPress={() => onNavigate('active_ride')} />
        </Card>
      )}

      {/* Bikes ready to ride */}
      <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <T variant="h3">Bikes ready to ride</T>
        <Pressable onPress={() => onNavigate('campus_map')} hitSlop={8}>
          <T variant="small" style={{ color: colors.primary, fontWeight: '800' }}>
            See all
          </T>
        </Pressable>
      </Row>
      {ready.length === 0 && (
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}>
          <Icon name="pedal_bike" size={36} color={colors.outline} />
          <T variant="small" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>
            No bikes are ready right now. Check back soon or open the map.
          </T>
        </Card>
      )}
      {ready.slice(0, 3).map((b) => (
        <BikeCard key={b.id} bike={b} onScan={() => onNavigate('scan')} disabled={!!activeBike} />
      ))}

      {/* My numbers */}
      <Row gap={12}>
        <Card style={styles.stat}>
          <T variant="tiny">Rides</T>
          <T variant="h2">{rides.length}</T>
        </Card>
        <Card style={styles.stat}>
          <T variant="tiny">Ride time</T>
          <T variant="h2">{usage}</T>
        </Card>
      </Row>

      {/* Recent rides */}
      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3">Recent rides</T>
          <Pressable onPress={() => onNavigate('ride_history')} hitSlop={8}>
            <T variant="small" style={{ color: colors.primary, fontWeight: '800' }}>
              View all
            </T>
          </Pressable>
        </Row>
        {rides.length === 0 && (
          <T variant="small" style={{ color: colors.onSurfaceVariant }}>
            No rides yet — scan a bike at the Covered Court to start.
          </T>
        )}
        {rides.slice(0, 2).map((r) => (
          <Pressable key={r.id} onPress={() => setReceipt(r)} style={styles.rideRow}>
            <View style={styles.bikeTag}>
              <T variant="tiny" style={{ fontWeight: '800', color: colors.onGold }}>
                {r.bikeId}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                {r.from} ➔ {r.to}
              </T>
              <T variant="tiny">
                {r.dateLabel} • {r.durationMin} min{r.durationMin === 1 ? '' : 's'}
              </T>
            </View>
            <Icon name="chevron_right" size={20} color={colors.outline} />
          </Pressable>
        ))}
      </Card>

      <Sheet visible={!!receipt} onClose={() => setReceipt(null)}>
        <Row gap={8}>
          <Icon name="receipt" size={22} color={colors.primary} />
          <T variant="h3">PedalPass Ride Receipt</T>
        </Row>
        <Divider />
        {receipt && (
          <View style={{ gap: 8 }}>
            <KeyValue k="Session ID" v={receipt.id.slice(0, 8).toUpperCase()} />
            <KeyValue k="Bicycle" v={receipt.bikeId} vStyle={{ color: colors.primary }} />
            <KeyValue k="Rider" v={user.name} />
            <KeyValue k="Date" v={receipt.dateLabel} />
            <KeyValue k="From" v={receipt.from} />
            <KeyValue k="To" v={receipt.to} />
            <KeyValue k="Duration" v={`${receipt.durationMin} min • ${receipt.distanceKm} km`} />
          </View>
        )}
        <Button label="Close" onPress={() => setReceipt(null)} />
      </Sheet>
    </Screen>
  );
}

/** A ready bike: who/what on top, a big picture, then where it is and the Scan button. */
function BikeCard({ bike, onScan, disabled }: { bike: BicycleItem; onScan: () => void; disabled: boolean }) {
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}>
          <View style={styles.bikeAvatar}>
            <Icon name="pedal_bike" size={20} color={colors.primary} />
          </View>
          <View>
            <T variant="h3">{bike.id}</T>
            <T variant="tiny">{bike.battery}% lock battery</T>
          </View>
        </Row>
        <View style={styles.valuePill}>
          <T variant="small" style={{ fontWeight: '800' }}>
            {bike.bay}
          </T>
        </View>
      </Row>
      <View style={styles.hero}>
        {bike.imageUrl ? (
          <Image source={{ uri: bike.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : (
          <Icon name="pedal_bike" size={110} color={colors.primary} />
        )}
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="small" style={{ fontWeight: '800' }} numberOfLines={1}>
            {bike.model}
          </T>
          <Row gap={4}>
            <Icon name="location_on" size={13} color={colors.onSurfaceVariant} />
            <T variant="tiny">{bike.station}</T>
          </Row>
        </View>
        <Button label="Scan to Ride" small variant="accent" onPress={onScan} disabled={disabled} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: colors.surface,
  },
  avatar: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.secondaryContainer },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadow,
  },
  tilesWrap: { marginHorizontal: -16 },
  tiles: { gap: 12, paddingHorizontal: 16, paddingVertical: 6 },
  riding: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primaryFill },
  ridingIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  bikeAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  valuePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surfaceContainer },
  hero: {
    height: 150,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stat: { flex: 1, gap: 2 },
  rideRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: colors.surfaceContainerLow },
  bikeTag: { width: 56, height: 36, borderRadius: radius.sm, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
});
