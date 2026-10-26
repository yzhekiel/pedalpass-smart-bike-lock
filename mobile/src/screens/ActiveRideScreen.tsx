import React, { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { BicycleItem, ScreenType } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Chip, Header, Row, Screen, Sheet, T } from '../components/ui';
import { confirmLocked } from '../services/lockService';

export type BikeCondition = 'good' | 'minor' | 'damaged';

type Props = {
  bike: BicycleItem | null;
  startedAt: number | null;
  onNavigate: (screen: ScreenType) => void;
  onEndRide: (condition: BikeCondition) => void;
};

const pad = (n: number) => n.toString().padStart(2, '0');
const formatTimer = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

export function ActiveRideScreen({ bike, startedAt, onNavigate, onEndRide }: Props) {
  const [now, setNow] = useState(Date.now());
  const [docking, setDocking] = useState(false);
  const [condition, setCondition] = useState<BikeCondition>('good');
  const [sosOpen, setSosOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!bike || !startedAt) {
    return (
      <Screen header={<Header title="My Ride" subtitle="No active session" onBack={() => onNavigate('home')} />}>
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 30 }}>
          <View style={styles.emptyIcon}>
            <Icon name="pedal_bike" size={36} color={colors.primary} />
          </View>
          <T variant="h2">No active ride</T>
          <T variant="small" style={{ textAlign: 'center', color: colors.onSurfaceVariant }}>
            Scan the QR code on any available campus bicycle to start riding.
          </T>
          <Button label="Scan Bicycle QR" icon="qr_code_scanner" onPress={() => onNavigate('scan')} />
        </Card>
      </Screen>
    );
  }

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const overLimit = elapsed > 45 * 60;

  const endRide = async () => {
    setDocking(true);
    try {
      const locked = await confirmLocked(bike);
      if (!locked) {
        Alert.alert('Lock not closed', 'Close the smart lock fully, then try again.');
        return;
      }
      onEndRide(condition);
      if (condition === 'damaged') {
        Alert.alert('Ride ended', 'Thanks! Please tell us what needs repair.', [
          { text: 'Report Issue', onPress: () => onNavigate('report_issue') },
        ]);
      } else {
        onNavigate('ride_history');
      }
    } finally {
      setDocking(false);
    }
  };

  return (
    <Screen
      header={
        <Header
          title="Active Ride"
          subtitle={`${bike.id} • In transit`}
          right={<Button label="SOS" icon="emergency" small variant="danger" onPress={() => setSosOpen(true)} />}
        />
      }
    >
      {/* Timer */}
      <Card style={styles.timerCard}>
        <T variant="tiny" style={{ color: colors.onPrimaryContainer, fontWeight: '800', letterSpacing: 0.6 }}>
          SESSION DURATION
        </T>
        <T style={styles.timer}>{formatTimer(elapsed)}</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Badge label={`${bike.battery}% lock battery`} icon="battery_charging_full" />
          <Badge
            label={overLimit ? 'Over 45-min limit' : 'Within 45-min limit'}
            bg={overLimit ? colors.errorContainer : 'rgba(255,255,255,0.18)'}
            fg={overLimit ? colors.onErrorContainer : '#fff'}
            icon="schedule"
          />
        </Row>
      </Card>

      {/* Return station */}
      <Card style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            <Icon name="location_on" size={20} color={colors.primary} />
            <T variant="h3">Return Station</T>
          </Row>
          <Badge label="Bay 04 Assigned" bg={colors.secondaryContainer} fg={colors.onSecondaryContainer} />
        </Row>
        <T variant="h2" style={{ fontSize: 16 }}>
          Main Gate Station Hub
        </T>
        <T variant="tiny">Bay 04 • Lock ready</T>
        <Row gap={4}>
          <Icon name="bluetooth_searching" size={15} color={colors.primary} />
          <T variant="tiny">Lock beacon detected nearby</T>
        </Row>
        <Button
          label="Change Station"
          small
          variant="outline"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => Alert.alert('Other stations', 'Science Quad and Admin Hall hubs also have free bays.')}
        />
      </Card>

      {/* Condition */}
      <Card style={{ gap: 10 }}>
        <T variant="h3">Bicycle condition before returning</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Chip label="Good" icon="check_circle" selected={condition === 'good'} activeColor={colors.success} onPress={() => setCondition('good')} />
          <Chip label="Minor issue" icon="warning" selected={condition === 'minor'} activeColor={colors.tertiary} onPress={() => setCondition('minor')} />
          <Chip label="Needs repair" icon="build" selected={condition === 'damaged'} activeColor={colors.error} onPress={() => setCondition('damaged')} />
        </Row>
      </Card>

      {/* How to dock */}
      <Card style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.surfaceContainerLow }}>
        <Icon name="sensors" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <T variant="h3">How to return</T>
          <T variant="tiny">
            Park at the bay and close the smart ring lock. The lock sensor confirms it is closed, then your ride ends.
          </T>
        </View>
      </Card>

      <Button
        label={docking ? 'Checking lock & syncing...' : 'End Ride & Lock Bicycle'}
        icon="lock"
        loading={docking}
        onPress={endRide}
      />

      <Sheet visible={sosOpen} onClose={() => setSosOpen(false)}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.errorContainer }]}>
            <Icon name="emergency" size={34} color={colors.error} />
          </View>
          <T variant="h2">Campus SOS</T>
          <T variant="small" style={{ textAlign: 'center' }}>
            Campus security will be alerted with your bicycle {bike.id}.
          </T>
        </View>
        <Button
          label="Alert Campus Security"
          icon="campaign"
          variant="danger"
          onPress={() => {
            // TODO: insert into the Supabase "alerts" table so the staff web portal sees it
            setSosOpen(false);
            Alert.alert('Alert sent', 'Campus security has been notified.');
          }}
        />
        <Button label="Call Local 104" icon="call" variant="outline" onPress={() => Linking.openURL('tel:104')} />
        <Button label="Cancel" variant="ghost" onPress={() => setSosOpen(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCard: { backgroundColor: colors.primary, borderColor: colors.primary, gap: 8, borderRadius: radius.xl },
  timer: { fontSize: 44, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'], letterSpacing: 1 },
});
