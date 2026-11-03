/**
 * Identity requirement photos (school ID, COR, selfie) and the on-phone face-match check.
 * Used by sign-up (RegisterScreen) and by resubmission after a rejection (VerifyIdentityScreen).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius } from '../theme';
import { Icon } from './Icon';
import { Button, Card, Row, T } from './ui';
import { FaceMatch, POSSIBLE_MATCH, STRONG_MATCH, useFaceMatcher } from './FaceMatcher';

export type Photo = { uri: string; base64: string };

/** Face-match score as a whole percent (what the student sees). */
const percent = (similarity: number | null) => Math.round((similarity ?? 0) * 100);

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true };

/** Opens the camera (front camera for selfies) or the photo library. Returns null if cancelled. */
export async function pickPhoto(selfie: boolean, fromLibrary = false): Promise<Photo | null> {
  const permission = fromLibrary
    ? await ImagePicker.requestMediaLibraryPermissionsAsync()
    : await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission needed', fromLibrary ? 'Allow photo access to choose a picture.' : 'Allow camera access to take the photo.');
    return null;
  }
  const result = fromLibrary
    ? await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS)
    : await ImagePicker.launchCameraAsync({
        ...PICKER_OPTIONS,
        cameraType: selfie ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      });
  const asset = result.canceled ? null : result.assets[0];
  return asset?.base64 ? { uri: asset.uri, base64: asset.base64 } : null;
}

export function PhotoCard({
  title,
  hint,
  icon,
  photo,
  selfie = false,
  onChange,
}: {
  title: string;
  hint: string;
  icon: string;
  photo?: Photo | null;
  selfie?: boolean;
  onChange: (photo: Photo) => void;
}) {
  const take = async (fromLibrary: boolean) => {
    const p = await pickPhoto(selfie, fromLibrary);
    if (p) onChange(p);
  };
  return (
    <Card style={{ gap: 10 }}>
      <Row gap={8}>
        <Icon name={photo ? 'check_circle' : icon} size={22} color={photo ? colors.success : colors.primary} />
        <View style={{ flex: 1 }}>
          <T variant="h3">{title}</T>
          <T variant="tiny">{hint}</T>
        </View>
      </Row>
      {photo && <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />}
      <Row gap={8}>
        <Button
          small
          style={{ flex: 1 }}
          icon="photo_camera"
          label={photo ? 'Retake' : 'Take photo'}
          variant={photo ? 'outline' : 'primary'}
          onPress={() => take(false)}
        />
        {!selfie && <Button small style={{ flex: 1 }} icon="image" label="Choose" variant="outline" onPress={() => take(true)} />}
      </Row>
    </Card>
  );
}

export type FaceCheck =
  | { status: 'waiting' }
  | { status: 'checking' }
  | { status: 'done'; match: FaceMatch }
  | { status: 'failed'; message: string };

/**
 * Compares the selfie with the ID photo whenever either changes.
 * `green` is true only for a strong match — the only result that may be submitted.
 */
export function useFaceCheck(idPhoto?: Photo | null, selfie?: Photo | null) {
  const { element, compare } = useFaceMatcher();
  const [check, setCheck] = useState<FaceCheck>({ status: 'waiting' });

  const run = useCallback(async () => {
    if (!idPhoto || !selfie) {
      setCheck({ status: 'waiting' });
      return;
    }
    setCheck({ status: 'checking' });
    try {
      setCheck({ status: 'done', match: await compare(idPhoto.base64, selfie.base64) });
    } catch (e) {
      setCheck({ status: 'failed', message: (e as Error).message });
    }
  }, [idPhoto, selfie, compare]);

  useEffect(() => {
    run();
  }, [run]);

  // Compare the rounded % the student sees, so "46%" always passes
  const green = check.status === 'done' && percent(check.match.similarity) >= percent(STRONG_MATCH);
  return { element, check, green, retry: run };
}

export function FaceCheckCard({ check, onRetry }: { check: FaceCheck; onRetry: () => void }) {
  if (check.status === 'waiting') {
    return (
      <Card style={[styles.result, { backgroundColor: colors.surfaceContainerLow }]}>
        <Icon name="face" size={22} color={colors.onSurfaceVariant} />
        <T variant="small" style={{ flex: 1 }}>
          Add your School ID and selfie to see your face-match score.
        </T>
      </Card>
    );
  }
  if (check.status === 'checking') {
    return (
      <Card style={[styles.result, { backgroundColor: colors.secondaryContainer }]}>
        <Icon name="hourglass_top" size={22} color={colors.primary} />
        <T variant="small" style={{ flex: 1 }}>
          Comparing your selfie with your ID photo… (the first check downloads the AI and can take up to a minute)
        </T>
      </Card>
    );
  }
  if (check.status === 'failed') {
    return (
      <Card style={[styles.result, { backgroundColor: colors.errorContainer }]}>
        <Icon name="error" size={22} color={colors.error} />
        <View style={{ flex: 1, gap: 6 }}>
          <T variant="small">{check.message}</T>
          <Button small label="Try again" icon="refresh" variant="outline" style={{ alignSelf: 'flex-start' }} onPress={onRetry} />
        </View>
      </Card>
    );
  }

  const { similarity, idFace, selfieFace } = check.match;
  const pct = similarity === null ? null : Math.round(similarity * 100);
  const strong = (pct ?? 0) >= percent(STRONG_MATCH);
  const possible = !strong && (pct ?? 0) >= percent(POSSIBLE_MATCH);
  const color = strong ? colors.success : possible ? colors.tertiary : colors.error;
  const bg = strong ? colors.successContainer : possible ? colors.tertiaryContainer : colors.errorContainer;
  const advice = !idFace
    ? 'No face found on the ID photo. Retake it straight on, without glare from the plastic holder.'
    : !selfieFace
      ? 'No face found in the selfie. Face the camera in good light, without a mask or sunglasses.'
      : strong
        ? 'Strong match. You can submit.'
        : 'Not a strong enough match. Retake your selfie facing the camera in good light (and the ID photo if it is blurry).';

  return (
    <Card style={[styles.result, { backgroundColor: bg }]}>
      <Icon name={strong ? 'verified' : 'face'} size={26} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="h3" style={{ color }}>
          Face match: {pct === null ? '—' : `${pct}%`}
        </T>
        <T variant="tiny">{advice}</T>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceContainer },
  result: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
