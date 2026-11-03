import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { BicycleItem, ScreenType, UserProfile } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Header, Row, Screen, T } from '../components/ui';
import { parseBikeQr, unlockBike } from '../services/lockService';
import {
  cancelRide,
  fetchBike,
  isLowBattery,
  LOW_BATTERY,
  reportInspection,
  requestUnlockToken,
  startRide,
  swapBike,
} from '../services/rideService';
import { InspectionResult, InspectionSheet } from '../components/InspectionSheet';

type Props = {
  user: UserProfile;
  bikes: BicycleItem[];
  hasActiveRide: boolean;
  onNavigate: (screen: ScreenType) => void;
  /** `ride` is the Supabase ride created by start_ride (absent in mock-data mode). */
  onStartRide: (bike: BicycleItem, ride: { rideId: string; startedAt: number }) => void;
  /** A bike's status may have changed on the server — reload the list. */
  onBikesChanged: () => void;
  /** Set while swapping bikes mid-ride: the new bike replaces this ride's bike (swap_bike). */
  swap?: { rideId: string; fromBikeId: string; reason: string } | null;
  /** The swap went through on the server but the new lock did not open: the rider has no ride now. */
  onSwapAborted?: () => void;
};

type AccessCheck = { title: string; ok: boolean; detail: string };

/**
 * Checks shown before unlocking. They reflect real data (the bike is re-read from the database);
 * the server repeats them in start_ride, which is the check that actually counts.
 */
function accessChecks(user: UserProfile, bike: BicycleItem, hasActiveRide: boolean): AccessCheck[] {
  const approved = !user.verificationStatus || user.verificationStatus === 'approved';
  return [
    { title: 'Bike found in the fleet', ok: true, detail: `${bike.id} • ${bike.station} (${bike.bay})` },
    {
      title: 'Your account is approved',
      ok: approved,
      detail: approved ? 'Identity check passed.' : 'Your identity check is not approved yet.',
    },
    {
      title: 'No other ride in progress',
      ok: !hasActiveRide,
      detail: hasActiveRide ? 'End your current ride first.' : 'You can start a new ride.',
    },
    {
      title: 'Bike is docked and available',
      ok: bike.status === 'available',
      detail: bike.status === 'available' ? 'Ready to unlock.' : `Status: ${bike.status.replace('_', ' ')}.`,
    },
    {
      title: 'Lock battery is charged',
      ok: !isLowBattery(bike),
      detail: !isLowBattery(bike)
        ? `${bike.battery}% — enough for a full ride.`
        : `${bike.battery}% — unavailable (bikes at ${LOW_BATTERY}% or lower can't be borrowed). Please choose another bike.`,
    },
  ];
}

export function ScanScreen({ user, bikes, hasActiveRide, onNavigate, onStartRide, onBikesChanged, swap, onSwapAborted }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [bike, setBike] = useState<BicycleItem | null>(null);
  const [qrCode, setQrCode] = useState(''); // secret part of the scanned QR, checked by start_ride
  const [looking, setLooking] = useState(false);
  const [countdown, setCountdown] = useState(45);
  const [unlocking, setUnlocking] = useState(false);
  const [stage, setStage] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const scanLock = useRef(false);

  const checks = bike ? accessChecks(user, bike, hasActiveRide && !swap) : [];
  const allOk = checks.length > 0 && checks.every((c) => c.ok);

  // Reservation countdown once all checks pass (paused while the rider inspects the bike)
  useEffect(() => {
    if (!bike || !allOk || inspecting) return;
    setCountdown(45);
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [bike, allOk, inspecting]);

  useEffect(() => {
    if (bike && countdown === 0 && !unlocking) {
      Alert.alert('Reservation expired', 'Scan the bicycle again to unlock.');
      resetScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const resetScan = () => {
    setBike(null);
    setQrCode('');
    scanLock.current = false;
  };

  const selectBikeById = async (id: string | null, source: string) => {
    let found: BicycleItem | undefined;
    if (id) {
      // Use the bike's current status, not the list loaded earlier
      setLooking(true);
      try {
        found = (await fetchBike(id)) ?? undefined;
      } catch (e) {
        Alert.alert('Could not check the bike', `${(e as Error).message}\nCheck your internet connection.`, [
          { text: 'OK', onPress: () => (scanLock.current = false) },
        ]);
        return;
      } finally {
        setLooking(false);
      }
    }
    if (!found) {
      Alert.alert('Bike not found', `"${source}" is not a PedalPass bicycle. Check the code on the lock plate.`, [
        { text: 'OK', onPress: () => (scanLock.current = false) },
      ]);
      return;
    }
    if (swap && found.id === swap.fromBikeId) {
      Alert.alert('Same bike', `Scan a different bike to swap ${found.id} for.`, [
        { text: 'OK', onPress: () => (scanLock.current = false) },
      ]);
      return;
    }
    if (found.status !== 'available') {
      const why = {
        maintenance: 'under maintenance',
        inspection: 'waiting for a maintenance check',
        in_use: 'already in use',
        locked: 'locked by admin',
      }[found.status];
      Alert.alert('Not available', `${found.id} is ${why}. Please choose another bike.`, [
        { text: 'OK', onPress: () => (scanLock.current = false) },
      ]);
      return;
    }
    setBike(found);
  };

  const onScanned = (result: BarcodeScanningResult) => {
    if (scanLock.current || bike || looking) return;
    scanLock.current = true;
    const qr = parseBikeQr(result.data);
    if (qr && !qr.code) {
      Alert.alert('Old QR code', `This QR code on ${qr.bikeId} no longer works. Please tell an admin so they can print a new one.`, [
        { text: 'OK', onPress: () => (scanLock.current = false) },
      ]);
      return;
    }
    setQrCode(qr?.code ?? '');
    selectBikeById(qr?.bikeId ?? null, result.data);
  };

  /** Checklist done: unlock (reporting any problems once riding), or report and pick another bike. */
  const onInspected = async (result: InspectionResult, ride: boolean) => {
    if (!bike) return;
    if (ride) {
      // Start the ride before reporting: a report on an available bike puts it under inspection
      setInspecting(false);
      onUnlock(result.problems.length > 0 ? result : undefined);
      return;
    }
    setReporting(true);
    try {
      const ticket = await reportInspection(user, bike, 'borrow', result, false);
      Alert.alert('Report sent', `Ticket ${ticket.id} was sent to maintenance, and ${bike.id} will be checked. Please choose another bike.`);
    } catch (e) {
      Alert.alert('Report not sent', `${(e as Error).message}\nCheck your internet connection and try again.`);
      return;
    } finally {
      setReporting(false);
    }
    setInspecting(false);
    onBikesChanged();
    resetScan();
  };

  // Server first: start_ride checks the QR code, approval and availability and reserves the bike, then
  // a signed token for that ride is sent to the lock. If the lock does not open, the ride is cancelled.
  // `problems` (rider chose "ride anyway") are reported once the ride has started.
  const onUnlock = async (problems?: InspectionResult) => {
    if (!bike || !allOk) return;
    setUnlocking(true);
    let ride: { rideId: string; startedAt: number } | undefined;
    try {
      setStage(swap ? 'Swapping bikes...' : 'Reserving bike...');
      ride = swap ? await swapBike(swap.rideId, bike.id, qrCode, swap.reason) : await startRide(bike.id, qrCode);
      setStage('Getting unlock key...');
      const token = await requestUnlockToken(ride.rideId);
      setStage('Opening smart lock...');
      const res = await unlockBike(bike, token);
      if (!res.ok) throw new Error(res.reason);
      onStartRide(bike, ride!);
      onNavigate('active_ride');
      if (problems) {
        reportInspection(user, bike, 'borrow', problems, true)
          .then((t) => Alert.alert('Report sent', `Ticket ${t.id} was sent to maintenance. Ride safely!`))
          .catch((e) =>
            Alert.alert('Report not sent', `${(e as Error).message}\nYou can send it from Report Issue after your ride.`),
          );
      }
    } catch (e) {
      let note = ride && swap ? `\nYour ride on ${swap.fromBikeId} has ended and it was reported. Scan any bike to ride again.` : '';
      if (ride) {
        const rideId = ride.rideId;
        await cancelRide(rideId).catch(() => {
          note = '\nThe ride could not be cancelled — reopen the app, it will show the ride so you can end it.';
        });
      }
      Alert.alert('Unlock failed', (e as Error).message + note);
      if (ride && swap) onSwapAborted?.(); // the old ride is over on the server
      onBikesChanged();
      resetScan();
    } finally {
      setUnlocking(false);
    }
  };

  const header = (
    <Header
      title={swap ? 'Swap Bike' : 'Scan & Unlock'}
      subtitle={swap ? `Scan the bike that replaces ${swap.fromBikeId}` : 'PedalPass DYCI Smart Lock'}
      onBack={() => onNavigate(swap ? 'active_ride' : 'home')}
      right={
        !bike && permission?.granted ? (
          <Pressable onPress={() => setTorch(!torch)} style={styles.roundBtn} accessibilityLabel="Toggle flashlight">
            <Icon name={torch ? 'flash_on' : 'flash_off'} size={20} color={colors.onSurface} />
          </Pressable>
        ) : undefined
      }
    />
  );

  return (
    <Screen header={header}>
      {!bike ? (
        <>
          {/* Camera */}
          <View style={styles.cameraBox}>
            {!permission ? (
              <ActivityIndicator color="#fff" />
            ) : permission.granted ? (
              <>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  enableTorch={torch}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={onScanned}
                />
                <View style={styles.frame} pointerEvents="none">
                  <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 }]} />
                  <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 }]} />
                  <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 }]} />
                  <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 }]} />
                </View>
                <View style={styles.camMeta} pointerEvents="none">
                  <View style={styles.recDot} />
                  <T variant="tiny" style={{ color: '#fff', fontWeight: '700' }}>
                    Point at the QR code on the bike lock
                  </T>
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: 10, padding: 20 }}>
                <Icon name="no_photography" size={40} color="#fff" />
                <T variant="small" style={{ color: '#fff', textAlign: 'center' }}>
                  PedalPass needs camera access to scan the bicycle QR code.
                </T>
                <Button label="Allow Camera" icon="photo_camera" variant="light" onPress={requestPermission} />
              </View>
            )}
          </View>

          <Card style={{ gap: 8 }}>
            <Row gap={8}>
              <Icon name="info" size={20} color={colors.primary} />
              <T variant="h3">How to unlock</T>
            </Row>
            <T variant="small">1. Scan the QR code on the smart lock.</T>
            <T variant="small">2. PedalPass checks your account and the bike.</T>
            <T variant="small">3. Tap "Unlock Bicycle Now", check the brakes, tires and chain, then unlock.</T>
          </Card>

          {looking && <ActivityIndicator color={colors.primary} />}

        </>
      ) : (
        <>
          {/* Detected bike */}
          <Card>
            <Row gap={12}>
              {bike.imageUrl ? (
                <Image source={{ uri: bike.imageUrl }} style={styles.bikeImg} />
              ) : (
                <View style={[styles.bikeImg, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="pedal_bike" size={32} color={colors.outline} />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  <Badge label={bike.id} />
                  <T variant="tiny">
                    {bike.station} ({bike.bay})
                  </T>
                </Row>
                <T variant="h3">{bike.model}</T>
                <Row gap={8}>
                  <Row gap={2}>
                    <Icon name="battery_charging_full" size={15} color={colors.success} />
                    <T variant="tiny">{bike.battery}% lock battery</T>
                  </Row>
                </Row>
              </View>
            </Row>
          </Card>

          {/* Verification steps */}
          <Card style={{ gap: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={6}>
                <Icon name="security" size={20} color={colors.primary} />
                <T variant="h3">Access Verification</T>
              </Row>
              {allOk && <Badge label="ALL CHECKS PASSED" bg={colors.successContainer} fg={colors.success} />}
            </Row>
            {checks.map((c, i) => (
              <Row key={c.title} gap={10} style={{ alignItems: 'flex-start' }}>
                <View style={[styles.stepDot, { backgroundColor: c.ok ? colors.success : colors.error }]}>
                  <Icon name={c.ok ? 'check' : 'close'} size={14} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T variant="small" style={{ fontWeight: '800', flex: 1 }}>
                      {i + 1}. {c.title}
                    </T>
                    <T variant="tiny" style={{ color: c.ok ? colors.success : colors.error, fontWeight: '800' }}>
                      {c.ok ? 'PASSED' : 'FAILED'}
                    </T>
                  </Row>
                  <T variant="tiny">{c.detail}</T>
                </View>
              </Row>
            ))}
            <T variant="tiny">The smart lock gets a one-time signed key when you tap Unlock.</T>
          </Card>

          {allOk && (
            <Card style={styles.granted}>
              <Row gap={10} style={{ flex: 1 }}>
                <View style={styles.grantedIcon}>
                  <Icon name="lock_open" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="h3" style={{ color: colors.success }}>
                    ACCESS GRANTED
                  </T>
                  <T variant="tiny">Bike reserved for the next {countdown}s</T>
                </View>
              </Row>
              <T style={{ fontSize: 26, fontWeight: '800', color: colors.success }}>{countdown}</T>
            </Card>
          )}

          <Button
            label={unlocking ? stage : 'UNLOCK BICYCLE NOW'}
            icon="key"
            loading={unlocking}
            disabled={!allOk}
            onPress={() => setInspecting(true)}
          />
          <Button label="Cancel & Scan Another Bike" variant="outline" onPress={resetScan} />
        </>
      )}

      {bike && (
        <InspectionSheet
          visible={inspecting}
          mode="borrow"
          bikeId={bike.id}
          busy={reporting}
          onClose={() => setInspecting(false)}
          onDone={onInspected}
        />
      )}    </Screen>
  );
}

const styles = StyleSheet.create({
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainer,
  },
  cameraBox: {
    height: 340,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: { width: 210, height: 210 },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: colors.gold, borderRadius: 4 },
  camMeta: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4d4d' },
  bikeImg: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.surfaceContainer },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  granted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.successContainer,
    borderColor: colors.success,
  },
  grantedIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
