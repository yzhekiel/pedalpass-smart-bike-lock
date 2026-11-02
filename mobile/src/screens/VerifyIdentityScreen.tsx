import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { UserProfile } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Button, Card, Header, Row, Screen, T } from '../components/ui';
import { loadProfile, submitVerification, uploadVerificationPhoto, VerificationDoc } from '../services/authService';

type Props = {
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  onLogout: () => void;
};

const DOCS: { id: VerificationDoc; title: string; hint: string; icon: string }[] = [
  { id: 'id', title: 'School ID', hint: 'Front of your DYCI ID, all text readable', icon: 'badge' },
  { id: 'cor', title: 'Certificate of Registration (COR)', hint: 'Current semester COR', icon: 'description' },
  { id: 'selfie', title: 'Selfie', hint: 'Your face, well lit, no mask or sunglasses', icon: 'face' },
];

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true };

export function VerifyIdentityScreen({ profile, onProfileChange, onLogout }: Props) {
  const [photos, setPhotos] = useState<Partial<Record<VerificationDoc, { uri: string; base64: string }>>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const status = profile.verificationStatus;

  const take = async (doc: VerificationDoc, fromLibrary = false) => {
    const permission = fromLibrary
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', fromLibrary ? 'Allow photo access to choose a picture.' : 'Allow camera access to take the photo.');
      return;
    }
    const result = fromLibrary
      ? await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS)
      : await ImagePicker.launchCameraAsync({
          ...PICKER_OPTIONS,
          cameraType: doc === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        });
    const asset = result.canceled ? null : result.assets[0];
    if (asset?.base64) setPhotos((prev) => ({ ...prev, [doc]: { uri: asset.uri, base64: asset.base64! } }));
  };

  const submit = async () => {
    const missing = DOCS.filter((d) => !photos[d.id]);
    if (missing.length) {
      Alert.alert('Photos missing', `Add: ${missing.map((d) => d.title).join(', ')}`);
      return;
    }
    if (!consent) {
      Alert.alert('Consent required', 'Please agree to the Data Privacy notice.');
      return;
    }
    setSubmitting(true);
    try {
      for (const d of DOCS) await uploadVerificationPhoto(profile.id, d.id, photos[d.id]!.base64);
      onProfileChange(await submitVerification(profile.id));
    } catch (e) {
      Alert.alert('Upload failed', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      onProfileChange(await loadProfile(profile.id));
    } catch (e) {
      Alert.alert('Could not refresh', (e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  if (status === 'pending_review') {
    return (
      <Screen bottomPad={40} header={<Header title="Identity Check" subtitle="Account & Identity" />}>
        <Card style={{ alignItems: 'center', gap: 8, backgroundColor: colors.secondaryContainer }}>
          <Icon name="hourglass_top" size={40} color={colors.primary} />
          <T variant="h3" style={{ textAlign: 'center' }}>
            Waiting for approval
          </T>
          <T variant="small" style={{ textAlign: 'center' }}>
            Campus staff are checking your school ID, COR and selfie. This usually takes less than a day. You can
            unlock bikes once you're approved.
          </T>
        </Card>
        <Button label="Check status" icon="refresh" loading={refreshing} onPress={refresh} />
        <Button label="Log out" icon="logout" variant="ghost" onPress={onLogout} />
      </Screen>
    );
  }

  return (
    <Screen bottomPad={40} header={<Header title="Identity Check" subtitle="Account & Identity" />}>
      {status === 'rejected' ? (
        <Card style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.errorContainer }}>
          <Icon name="error" size={22} color={colors.error} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="h3">Not approved</T>
            <T variant="small">{profile.rejectionReason ?? 'Please upload clearer photos.'}</T>
            <T variant="tiny">Fix the problem above and submit again.</T>
          </View>
        </Card>
      ) : (
        <Card style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.secondaryContainer }}>
          <Icon name="verified_user" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <T variant="h3">Verify you're a DYCI student or faculty</T>
            <T variant="tiny">
              Add 3 photos. Campus staff compare your selfie with your school ID, then approve your bike pass.
            </T>
          </View>
        </Card>
      )}

      {DOCS.map((d) => {
        const photo = photos[d.id];
        return (
          <Card key={d.id} style={{ gap: 10 }}>
            <Row gap={8}>
              <Icon name={photo ? 'check_circle' : d.icon} size={22} color={photo ? colors.success : colors.primary} />
              <View style={{ flex: 1 }}>
                <T variant="h3">{d.title}</T>
                <T variant="tiny">{d.hint}</T>
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
                onPress={() => take(d.id)}
              />
              {d.id !== 'selfie' && (
                <Button small style={{ flex: 1 }} icon="image" label="Choose" variant="outline" onPress={() => take(d.id, true)} />
              )}
            </Row>
          </Card>
        );
      })}

      <Pressable onPress={() => setConsent(!consent)}>
        <Card style={{ flexDirection: 'row', gap: 10 }}>
          <Icon
            name={consent ? 'check_box' : 'check_box_outline_blank'}
            size={22}
            color={consent ? colors.primary : colors.outline}
          />
          <T variant="tiny" style={{ flex: 1 }}>
            I agree that PedalPass may collect my school ID, COR and selfie only to verify my identity, under the Data
            Privacy Act of 2012 (RA 10173). Campus staff compare my selfie with my ID photo with the help of an
            automatic face-matching check that runs on PedalPass's own system. Only authorized campus staff can view
            the photos, and they are deleted after review.
          </T>
        </Card>
      </Pressable>

      <Button label="Submit for Approval" iconRight="send" loading={submitting} onPress={submit} />
      {submitting && (
        <T variant="tiny" style={{ textAlign: 'center' }}>
          Uploading your photos…
        </T>
      )}
      <Button label="Log out" icon="logout" variant="ghost" onPress={onLogout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceContainer },
});
