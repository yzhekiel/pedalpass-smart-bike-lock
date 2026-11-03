import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RideRecord, ScreenType, UserProfile } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Chip, Divider, Header, KeyValue, Row, Screen, Sheet, T } from '../components/ui';

type Props = {
  user: UserProfile;
  rides: RideRecord[];
  onNavigate: (screen: ScreenType) => void;
};

type Filter = 'all' | 'week' | 'issues';

export function RideHistoryScreen({ user, rides, onNavigate }: Props) {
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
    <Screen header={<Header title="Ride History" subtitle="Your PedalPass trips" onBack={() => onNavigate('home')} />}>
      {/* Summary */}
      <Card style={{ backgroundColor: colors.primaryFill, borderColor: colors.primaryFill, gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            <Icon name="eco" size={20} color={colors.gold} />
            <T variant="h3" style={{ color: '#fff' }}>
              My Ride Summary
            </T>
          </Row>
          <Badge label="Green Rider" />
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

      <Row gap={8}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="This Week" selected={filter === 'week'} onPress={() => setFilter('week')} />
        <Chip label="With Issues" selected={filter === 'issues'} onPress={() => setFilter('issues')} />
      </Row>

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
            <Row gap={8}>
              <Button
                label="Report Problem"
                variant="outline"
                small
                style={{ flex: 1 }}
                onPress={() => {
                  setSelected(null);
                  onNavigate('report_issue');
                }}
              />
              <Button label="Close" small style={{ flex: 1 }} onPress={() => setSelected(null)} />
            </Row>
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bikeTag: {
    width: 54,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.gold + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
