import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BicycleItem, RideRecord, ScreenType, UserProfile } from '../types';
import { colors, radius, shadow } from '../theme';
import { Icon } from '../components/Icon';
import { Button, Card, Divider, KeyValue, RiderInfoHeader, Row, Screen, Sheet, T } from '../components/ui';
import { isReady } from '../services/rideService';

type Props = {
  user: UserProfile;
  bikes: BicycleItem[];
  rides: RideRecord[];
  loading: boolean;
  onNavigate: (screen: ScreenType) => void;
  activeBike: BicycleItem | null;
};

// The only PedalPass station (see supabase/migrations/006_covered_court_station.sql)
const STATION = 'Covered Court Hub';

export function HomeScreen({ user, bikes, rides, loading, onNavigate, activeBike }: Props) {
  const [receipt, setReceipt] = useState<RideRecord | null>(null);
  const ready = bikes.filter(isReady);

  return (
    <Screen
      header={<RiderInfoHeader name={user.name} memberType={user.memberType} avatarUrl={user.avatarUrl} />}
    >
      {loading ? (
        <HomeSkeleton />
      ) : (
        <>
      {/* Station availability, shown as information rather than a map link. */}
      <View style={styles.stationCard}>
        <View style={styles.stationIcon}>
          <Icon name="location_on" size={23} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stationEyebrow}>BIKE STATION</Text>
          <Text style={styles.stationName}>{STATION}</Text>
        </View>
        <View style={[styles.availabilityPill, ready.length === 0 && styles.availabilityPillEmpty]}>
          <View style={[styles.availabilityDot, ready.length === 0 && styles.availabilityDotEmpty]} />
          <Text style={[styles.availabilityText, ready.length === 0 && styles.availabilityTextEmpty]}>
            {ready.length} ready
          </Text>
        </View>
      </View>

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
        <View>
          <Text style={styles.sectionEyebrow}>AVAILABLE NOW</Text>
          <Text style={styles.sectionTitle}>Bikes ready to ride</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{ready.length}</Text>
        </View>
      </Row>
      {ready.length === 0 && (
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}>
          <Icon name="pedal_bike" size={36} color={colors.outline} />
          <T variant="small" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>
            No bikes are ready right now. Please check again soon.
          </T>
        </Card>
      )}
      {ready.slice(0, 3).map((b) => (
        <BikeCard key={b.id} bike={b} onScan={() => onNavigate('scan')} disabled={!!activeBike} />
      ))}

      {/* Recent rides */}
      <Card style={styles.recentCard}>
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
        </>
      )}
    </Screen>
  );
}

function HomeSkeleton() {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.skeletonWrap, { opacity: pulse }]} accessibilityLabel="Loading bike availability">
      <View style={styles.skeletonStation}>
        <View style={styles.skeletonIcon} />
        <View style={styles.skeletonCopy}>
          <View style={[styles.skeletonLine, { width: '34%' }]} />
          <View style={[styles.skeletonLine, styles.skeletonLineStrong, { width: '68%' }]} />
        </View>
        <View style={styles.skeletonPill} />
      </View>

      <View style={styles.skeletonHeading}>
        <View style={[styles.skeletonLine, { width: '28%' }]} />
        <View style={[styles.skeletonLine, styles.skeletonLineStrong, { width: '56%' }]} />
      </View>

      <View style={styles.skeletonBikeCard}>
        <View style={styles.skeletonBikeTop}>
          <View style={styles.skeletonIcon} />
          <View style={[styles.skeletonLine, styles.skeletonLineStrong, { width: '30%' }]} />
        </View>
        <View style={styles.skeletonBikeImage} />
        <View style={[styles.skeletonLine, { width: '48%' }]} />
      </View>

    </Animated.View>
  );
}

/** A ready bike: who/what on top, a big picture, then where it is and the Scan button. */
function BikeCard({ bike, onScan, disabled }: { bike: BicycleItem; onScan: () => void; disabled: boolean }) {
  return (
    <Card style={styles.bikeCard}>
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
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: -18,
    marginHorizontal: 2,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    ...shadow,
  },
  stationIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryFill },
  stationEyebrow: { color: colors.onSurfaceVariant, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  stationName: { color: colors.onSurface, fontSize: 14, fontWeight: '900', marginTop: 2 },
  availabilityPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.successContainer },
  availabilityPillEmpty: { backgroundColor: colors.surfaceContainer },
  availabilityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  availabilityDotEmpty: { backgroundColor: colors.outline },
  availabilityText: { color: colors.success, fontSize: 10, fontWeight: '900' },
  availabilityTextEmpty: { color: colors.onSurfaceVariant },
  sectionEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  sectionTitle: { color: colors.onSurface, fontSize: 17, fontWeight: '900', letterSpacing: -0.3, marginTop: 2 },
  countPill: { minWidth: 34, height: 34, paddingHorizontal: 10, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer },
  countText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  riding: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 20, backgroundColor: colors.primaryFill },
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
  bikeCard: { gap: 16, borderWidth: 1, borderColor: colors.outlineVariant },
  recentCard: { gap: 16, borderWidth: 1, borderColor: colors.outlineVariant },
  skeletonWrap: { gap: 20 },
  skeletonStation: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: -18,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  skeletonIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surfaceContainerHigh },
  skeletonCopy: { flex: 1, gap: 8 },
  skeletonLine: { height: 9, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  skeletonLineStrong: { height: 13 },
  skeletonPill: { width: 62, height: 28, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  skeletonHeading: { gap: 8, marginTop: 4 },
  skeletonBikeCard: { gap: 16, padding: 18, borderRadius: radius.lg, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.outlineVariant },
  skeletonBikeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skeletonBikeImage: { height: 150, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHigh },
  rideRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: colors.surfaceContainerLow },
  bikeTag: { width: 56, height: 36, borderRadius: radius.sm, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
});
