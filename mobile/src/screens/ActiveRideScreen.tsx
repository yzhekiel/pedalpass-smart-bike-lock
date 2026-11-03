import React, { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { BicycleItem, ScreenType } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Chip, Field, Header, Row, Screen, Sheet, T } from '../components/ui';
import { InspectionResult, InspectionSheet } from '../components/InspectionSheet';
import { confirmLocked } from '../services/lockService';

export type BikeCondition = 'good' | 'minor' | 'damaged';

/** The return checklist decides the condition end_ride records. */
export const conditionOf = (r: InspectionResult): BikeCondition =>
  r.unsafe ? 'damaged' : r.problems.length ? 'minor' : 'good';

type Props = {
  bike: BicycleItem | null;
  startedAt: number | null;
  onNavigate: (screen: ScreenType) => void;
  /** Ends the ride and sends any problems to maintenance. Resolves false if the ride could not be ended. */
  onEndRide: (inspection: InspectionResult) => Promise<boolean>;
  /** Saves an SOS alert for campus security; throws if it could not be sent. */
  onSos: () => Promise<void>;
  /** The current bike is locked; go scan another one to swap to, for this reason. */
  onSwap: (reason: string) => void;
};

const SWAP_REASONS = ['Flat tire', 'Brakes', 'Chain', 'Seat / handlebar', 'Lock problem', 'Other'];

const pad = (n: number) => n.toString().padStart(2, '0');
const formatTimer = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

export function ActiveRideScreen({ bike, startedAt, onNavigate, onEndRide, onSos, onSwap }: Props) {
  const [now, setNow] = useState(Date.now());
  const [docking, setDocking] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapReason, setSwapReason] = useState('');
  const [swapNote, setSwapNote] = useState('');
  const [swapLocking, setSwapLocking] = useState(false);

  // The old bike must be locked at the station before the rider takes another one
  const startSwap = async () => {
    if (!bike) return;
    setSwapLocking(true);
    try {
      if (!(await confirmLocked(bike))) {
        Alert.alert('Lock not closed', `Park ${bike.id} at the station and close its lock first.`);
        return;
      }
      setSwapOpen(false);
      onSwap(swapNote.trim() ? `${swapReason} — ${swapNote.trim()}` : swapReason);
    } finally {
      setSwapLocking(false);
    }
  };

  const raiseSos = async () => {
    setSosSending(true);
    try {
      await onSos();
      setSosOpen(false);
      Alert.alert('Alert sent', 'Campus security has been notified. If you are in danger, also call Local 104.');
    } catch (e) {
      // Never pretend the alert went through — point the rider to the phone line instead
      Alert.alert('Alert NOT sent', `${(e as Error).message}\nCall Campus Security now.`, [
        { text: 'Call Local 104', onPress: () => Linking.openURL('tel:104') },
        { text: 'Close', style: 'cancel' },
      ]);
    } finally {
      setSosSending(false);
    }
  };

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

  const endRide = async (inspection: InspectionResult) => {
    setDocking(true);
    try {
      const locked = await confirmLocked(bike);
      if (!locked) {
        setInspecting(false);
        Alert.alert('Lock not closed', 'Close the smart lock fully, then try again.');
        return;
      }
      if (!(await onEndRide(inspection))) return;
      setInspecting(false);
      onNavigate('ride_history');
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
          <Badge label={bike.bay} bg={colors.secondaryContainer} fg={colors.onSecondaryContainer} />
        </Row>
        <T variant="h2" style={{ fontSize: 16 }}>
          {bike.station}
        </T>
        <T variant="tiny">
          Elida Campus Covered Court, beside Bldg. B. Bring {bike.id} back here and lock it to {bike.bay}.
        </T>
      </Card>

      {/* How to dock */}
      <Card style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.surfaceContainerLow }}>
        <Icon name="sensors" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <T variant="h3">How to return</T>
          <T variant="tiny">
            Park at the bay, check the bike, and close the smart ring lock. The lock sensor confirms it is closed, then your
            ride ends. Any problem you report goes straight to maintenance.
          </T>
        </View>
      </Card>

      <Button
        label={docking ? 'Checking lock & syncing...' : 'End Ride & Lock Bicycle'}
        icon="lock"
        loading={docking}
        onPress={() => setInspecting(true)}
      />
      <Button label="Problem with this bike? Swap Bike" icon="swap_horiz" variant="outline" onPress={() => setSwapOpen(true)} />

      <Sheet visible={swapOpen} onClose={() => !swapLocking && setSwapOpen(false)}>
        <T variant="h3">Swap {bike.id} for another bike</T>
        <T variant="tiny">
          Bring {bike.id} back to {bike.station} and lock it. Your ride continues on the new bike, and maintenance gets a
          report about {bike.id}.
        </T>
        <T variant="label">What is wrong?</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {SWAP_REASONS.map((r) => (
            <Chip key={r} label={r} selected={swapReason === r} activeColor={colors.error} onPress={() => setSwapReason(r)} />
          ))}
        </Row>
        <Field value={swapNote} onChangeText={setSwapNote} placeholder="More details (optional)" icon="edit_note" autoCapitalize="sentences" />
        <Button
          label={swapLocking ? 'Checking lock…' : 'Lock This Bike & Scan New One'}
          icon="qr_code_scanner"
          loading={swapLocking}
          disabled={!swapReason}
          onPress={startSwap}
        />
        <Button label="Cancel" variant="ghost" disabled={swapLocking} onPress={() => setSwapOpen(false)} />
      </Sheet>

      <InspectionSheet
        visible={inspecting}
        mode="return"
        bikeId={bike.id}
        busy={docking}
        onClose={() => setInspecting(false)}
        onDone={endRide}
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
          loading={sosSending}
          onPress={raiseSos}
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
  timerCard: { backgroundColor: colors.primaryFill, borderColor: colors.primaryFill, gap: 8, borderRadius: radius.xl },
  // lineHeight must match the font size: T's default (body) line height of 19 cuts the digits off
  timer: { fontSize: 44, lineHeight: 54, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'], letterSpacing: 1 },
});
