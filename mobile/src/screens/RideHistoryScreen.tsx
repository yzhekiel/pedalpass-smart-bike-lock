import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BicycleItem, RideRecord, ScreenType, UserProfile } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Chip, Divider, Header, KeyValue, Row, Screen, Sheet, T } from '../components/ui';

type Props = {
  user: UserProfile;
  rides: RideRecord[];
  onNavigate: (screen: ScreenType) => void;
  /** The ride in progress, shown on top (My Rides = the current ride + past rides) */
  activeBike: BicycleItem | null;
  rideStartedAt: number | null;
};

type Filter = 'all' | 'week' | 'issues';

export function RideHistoryScreen({ user, rides, onNavigate, activeBike, rideStartedAt }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<RideRecord | null>(null);

  const shown = useMemo(() => {
    if (filter === 'issues') return rides.filter((r) => r.status === 'Issue Reported');
    if (filter === 'week') return rides.filter((r) => /Today|Yesterday|Just now/.test(r.dateLabel));
    return rides;
  }, [filter, rides]);

  const totalKm = rides.reduce((s, r) => s + r.distanceKm, 0);
  const totalMin = rides.reduce((s, r) => s + r.durationMin, 0);

  return (
    <Screen header={<Header title="My Rides" subtitle="Your ride now and your past trips" onBack={() => onNavigate('home')} />}>
      <Row gap={8} style={styles.filters}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="This Week" selected={filter === 'week'} onPress={() => setFilter('week')} />
        <Chip label="With Issues" selected={filter === 'issues'} onPress={() => setFilter('issues')} />
      </Row>

      {/* Summary */}
      <Card style={styles.summary}>
        <Row gap={6}>
          <Icon name="insights" size={20} color={colors.gold} />
          <T variant="h3" style={{ color: '#fff' }}>
            My Ride Summary
          </T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          {[
            { v: String(rides.length), l: 'Rides' },
            { v: totalKm.toFixed(1), l: 'km' },
            { v: `${totalMin}m`, l: 'Ride time' },
          ].map((s) => (
            <View key={s.l} style={{ alignItems: 'center', flex: 1 }}>
              <T style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>{s.v}</T>
              <T variant="tiny" style={{ color: colors.onPrimaryContainer }}>
                {s.l}
              </T>
            </View>
          ))}
        </Row>
      </Card>

      {/* Only show this section when a ride is actually in progress. */}
      {activeBike && rideStartedAt ? (
        <CurrentRide bikeId={activeBike.id} station={activeBike.station} startedAt={rideStartedAt} onOpen={() => onNavigate('active_ride')} />
      ) : null}

      {shown.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <T variant="small" style={{ color: colors.onSurfaceVariant }}>
            No rides for this filter yet.
          </T>
        </Card>
      ) : (
        shown.map((r) => (
          <Pressable key={r.id} onPress={() => setSelected(r)}>
            <Card>
              <Row gap={12}>
                <View style={styles.bikeTag}>
                  <T variant="tiny" style={{ fontWeight: '800', color: colors.primary }}>
                    {r.bikeId}
                  </T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="small" style={{ fontWeight: '800' }}>
                    {r.from} ➔ {r.to}
                  </T>
                  <T variant="tiny">
                    {r.dateLabel} • {r.durationMin} mins • {r.distanceKm} km
                  </T>
                  {r.note ? (
                    <T variant="tiny" style={{ color: colors.tertiary, fontWeight: '700' }}>
                      {r.note}
                    </T>
                  ) : null}
                </View>
                <Badge
                  label={r.status === 'Completed' ? 'Done' : 'Issue'}
                  bg={r.status === 'Completed' ? colors.successContainer : colors.tertiaryContainer}
                  fg={r.status === 'Completed' ? colors.success : colors.tertiary}
                />
              </Row>
            </Card>
          </Pressable>
        ))
      )}

      <Sheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <T variant="h3">Dr. Yanga's Colleges, Inc.</T>
              <T variant="tiny">PedalPass Electronic Ride Receipt</T>
              <T variant="tiny" style={{ fontFamily: 'monospace' }}>
                {selected.id}
              </T>
            </View>
            <Divider />
            <View style={{ gap: 8 }}>
              <KeyValue k="Rider" v={user.name} />
              <KeyValue k="Bicycle" v={selected.bikeId} vStyle={{ color: colors.primary }} />
              <KeyValue k="From" v={selected.from} />
              <KeyValue k="To" v={selected.to} />
              <KeyValue k="Date" v={selected.dateLabel} />
              <KeyValue k="Duration" v={`${selected.durationMin} mins`} />
              <KeyValue k="Fee" v="₱0.00 (Campus service)" />
            </View>
            <Button label="Close" small onPress={() => setSelected(null)} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const pad = (n: number) => n.toString().padStart(2, '0');

/** The ride in progress: bike, running time, and a button to the ride screen (end ride, SOS, swap). */
function CurrentRide({ bikeId, station, startedAt, onOpen }: { bikeId: string; station: string; startedAt: number; onOpen: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <Card style={styles.current}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          <View style={styles.liveDot} />
          <T variant="tiny" style={{ color: colors.onPrimaryContainer, fontWeight: '800', letterSpacing: 0.6 }}>
            RIDE IN PROGRESS
          </T>
        </Row>
        <Badge label={bikeId} />
      </Row>
      <T style={styles.timer}>
        {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
      </T>
      <T variant="tiny" style={{ color: colors.onPrimaryContainer }}>
        Return it to {station} when you're done.
      </T>
      <Button label="Open ride" icon="arrow_forward" variant="accent" onPress={onOpen} />
    </Card>
  );
}

const styles = StyleSheet.create({
  filters: { alignSelf: 'stretch', flexWrap: 'wrap' },
  summary: { backgroundColor: colors.primaryFill, gap: 14, paddingVertical: 20 },
  current: { backgroundColor: colors.primaryFill, gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  // lineHeight must match the font size, or the digits get cut off
  timer: { fontSize: 36, lineHeight: 44, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  bikeTag: {
    width: 54,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.gold + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
