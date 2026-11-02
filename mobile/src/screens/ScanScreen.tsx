import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { BicycleItem, ScreenType, UserProfile } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Field, Header, Row, Screen, Sheet, T } from '../components/ui';
import { parseBikeQr, unlockBike } from '../services/lockService';
import { cancelRide, fetchBike, requestUnlockToken, startRide } from '../services/rideService';

type Props = {
  user: UserProfile;
  bikes: BicycleItem[];
  hasActiveRide: boolean;
  onNavigate: (screen: ScreenType) => void;
  /** `ride` is the Supabase ride created by start_ride (absent in mock-data mode). */
  onStartRide: (bike: BicycleItem, ride: { rideId: string; startedAt: number }) => void;
  /** A bike's status may have changed on the server — reload the list. */
  onBikesChanged: () => void;
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
  ];
}

export function ScanScreen({ user, bikes, hasActiveRide, onNavigate, onStartRide, onBikesChanged }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [bike, setBike] = useState<BicycleItem | null>(null);
  const [looking, setLooking] = useState(false);
  const [countdown, setCountdown] = useState(45);
  const [unlocking, setUnlocking] = useState(false);
  const [stage, setStage] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scanLock = useRef(false);

  const checks = bike ? accessChecks(user, bike, hasActiveRide) : [];
  const allOk = checks.length > 0 && checks.every((c) => c.ok);

  // Reservation countdown once all checks pass
  useEffect(() => {
    if (!bike || !allOk) return;
    setCountdown(45);
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [bike, allOk]);

  useEffect(() => {
    if (bike && countdown === 0 && !unlocking) {
      Alert.alert('Reservation expired', 'Scan the bicycle again to unlock.');
      resetScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const resetScan = () => {
    setBike(null);
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
    if (found.status !== 'available') {
      const why = found.status === 'maintenance' ? 'under maintenance' : found.status === 'in_use' ? 'already in use' : 'locked by admin';
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
    selectBikeById(parseBikeQr(result.data), result.data);
  };

  const onManualConfirm = () => {
    setManualOpen(false);
    selectBikeById(parseBikeQr(manualCode), manualCode);
  };

  // Server first: start_ride checks approval/availability and reserves the bike, then a signed
  // token for that ride is sent to the lock. If the lock does not open, the ride is cancelled.
  const onUnlock = async () => {
    if (!bike || !allOk) return;
    setUnlocking(true);
    let ride: { rideId: string; startedAt: number } | undefined;
    try {
      setStage('Reserving bike...');
      ride = await startRide(bike.id);
      setStage('Getting unlock key...');
      const token = await requestUnlockToken(ride.rideId);
      setStage('Opening smart lock...');
      const res = await unlockBike(bike, token);
      if (!res.ok) throw new Error(res.reason);
      onStartRide(bike, ride!);
      onNavigate('active_ride');
    } catch (e) {
      let note = '';
      if (ride) {
        const rideId = ride.rideId;
        await cancelRide(rideId).catch(() => {
          note = '\nThe ride could not be cancelled — reopen the app, it will show the ride so you can end it.';
        });
      }
      Alert.alert('Unlock failed', (e as Error).message + note);
      onBikesChanged();
      resetScan();
    } finally {
      setUnlocking(false);
    }
  };

  const header = (
    <Header
      title="Scan & Unlock"
      subtitle="PedalPass DYCI Smart Lock"
      onBack={() => onNavigate('home')}
      right={
        <Row gap={6}>
          {!bike && permission?.granted && (
            <Pressable onPress={() => setTorch(!torch)} style={styles.roundBtn} accessibilityLabel="Toggle flashlight">
              <Icon name={torch ? 'flash_on' : 'flash_off'} size={20} color={colors.onSurface} />
            </Pressable>
          )}
          <Button label="Enter Code" small variant="outline" onPress={() => setManualOpen(true)} />
        </Row>
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
            <T variant="small">1. Scan the QR code on the smart lock (or tap "Enter Code").</T>
            <T variant="small">2. PedalPass checks your account and the bike.</T>
            <T variant="small">3. Tap "Unlock Bicycle Now" while standing next to the bike.</T>
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
            onPress={onUnlock}
          />
          <Button label="Cancel & Scan Another Bike" variant="outline" onPress={resetScan} />
        </>
      )}

      <Sheet visible={manualOpen} onClose={() => setManualOpen(false)}>
        <T variant="h3">Enter Bicycle Code</T>
        <T variant="tiny">The code is printed on the lock plate (e.g. BP-001, BP-012).</T>
        <Field
          value={manualCode}
          onChangeText={(v) => setManualCode(v.toUpperCase())}
          placeholder="BP-001"
          icon="pedal_bike"
          autoCapitalize="characters"
        />
        <Row gap={8}>
          <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setManualOpen(false)} />
          <Button label="Confirm" style={{ flex: 1 }} onPress={onManualConfirm} />
        </Row>
      </Sheet>
    </Screen>
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
    backgroundColor: '#0b1c30',
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
