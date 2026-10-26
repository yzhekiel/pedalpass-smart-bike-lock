import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { BicycleItem, ScreenType } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Field, Header, Row, Screen, Sheet, T } from '../components/ui';
import { parseBikeQr, requestUnlockToken, unlockBike } from '../services/lockService';

type Props = {
  bikes: BicycleItem[];
  hasActiveRide: boolean;
  onNavigate: (screen: ScreenType) => void;
  onStartRide: (bike: BicycleItem) => void;
};

const STEPS = [
  { title: 'QR Code Verified', desc: 'Bike code matches the DYCI fleet registry.', tag: 'PASSED' },
  { title: 'Rider Authorization', desc: 'Active student/staff account. No active ride or penalties.', tag: 'CLEARED' },
  { title: 'Bicycle Availability', desc: 'Bike is docked and available.', tag: 'CONFIRMED' },
  { title: 'Smart Lock Handshake', desc: 'One-time unlock token issued for the ESP32 lock.', tag: 'SYNCED' },
  { title: 'Ready to Unlock', desc: 'The lock will release when you confirm.', tag: 'READY' },
];

export function ScanScreen({ bikes, hasActiveRide, onNavigate, onStartRide }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [bike, setBike] = useState<BicycleItem | null>(null);
  const [stepsDone, setStepsDone] = useState(0);
  const [countdown, setCountdown] = useState(45);
  const [unlocking, setUnlocking] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scanLock = useRef(false);

  // Animate the verification steps once a bike is selected
  useEffect(() => {
    if (!bike) return;
    setStepsDone(0);
    setCountdown(45);
    const t = setInterval(() => setStepsDone((n) => (n < STEPS.length ? n + 1 : n)), 350);
    return () => clearInterval(t);
  }, [bike]);

  // Reservation countdown after all checks pass
  useEffect(() => {
    if (!bike || stepsDone < STEPS.length) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [bike, stepsDone]);

  useEffect(() => {
    if (bike && countdown === 0 && !unlocking) {
      Alert.alert('Reservation expired', 'Scan the bicycle again to unlock.');
      resetScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const resetScan = () => {
    setBike(null);
    setStepsDone(0);
    scanLock.current = false;
  };

  const selectBikeById = (id: string | null, source: string) => {
    const found = id ? bikes.find((b) => b.id === id) : undefined;
    if (!found) {
      Alert.alert('Bike not found', `"${source}" is not a PedalPass bicycle. Try BP-001 or BP-012.`, [
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
    if (scanLock.current || bike) return;
    scanLock.current = true;
    selectBikeById(parseBikeQr(result.data), result.data);
  };

  const onManualConfirm = () => {
    setManualOpen(false);
    selectBikeById(parseBikeQr(manualCode), manualCode);
  };

  const onUnlock = async () => {
    if (!bike) return;
    if (hasActiveRide) {
      Alert.alert('Active ride', 'End your current ride before unlocking another bike.');
      return;
    }
    setUnlocking(true);
    try {
      const token = await requestUnlockToken(bike);
      const res = await unlockBike(bike, token);
      if (!res.ok) {
        Alert.alert('Unlock failed', res.reason);
        return;
      }
      onStartRide(bike);
      onNavigate('active_ride');
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

          <Card style={{ gap: 8, backgroundColor: colors.surfaceContainerLow }}>
            <T variant="label">No QR code nearby? Demo bikes:</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {bikes.map((b) => (
                <Button
                  key={b.id}
                  label={b.id}
                  small
                  variant={b.status === 'available' ? 'primary' : 'outline'}
                  onPress={() => selectBikeById(b.id, b.id)}
                />
              ))}
            </Row>
          </Card>
        </>
      ) : (
        <>
          {/* Detected bike */}
          <Card>
            <Row gap={12}>
              <Image source={{ uri: bike.imageUrl }} style={styles.bikeImg} />
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
              {stepsDone >= STEPS.length && (
                <Badge label="ALL CHECKS PASSED" bg={colors.successContainer} fg={colors.success} />
              )}
            </Row>
            {STEPS.map((s, i) => {
              const done = i < stepsDone;
              return (
                <Row key={s.title} gap={10} style={{ alignItems: 'flex-start', opacity: done ? 1 : 0.45 }}>
                  <View style={[styles.stepDot, done && { backgroundColor: colors.success }]}>
                    {done ? (
                      <Icon name="check" size={14} color="#fff" />
                    ) : (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T variant="small" style={{ fontWeight: '800', flex: 1 }}>
                        {i + 1}. {s.title}
                      </T>
                      {done && (
                        <T variant="tiny" style={{ color: colors.success, fontWeight: '800' }}>
                          {s.tag}
                        </T>
                      )}
                    </Row>
                    <T variant="tiny">{s.desc.replace('Bike is', `${bike.id} is`)}</T>
                  </View>
                </Row>
              );
            })}
          </Card>

          {stepsDone >= STEPS.length && (
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
            label={unlocking ? 'Unlocking smart lock...' : 'UNLOCK BICYCLE NOW'}
            icon="key"
            loading={unlocking}
            disabled={stepsDone < STEPS.length}
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
