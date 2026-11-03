import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { UserProfile } from '../types';
import { colors } from '../theme';
import { Icon } from '../components/Icon';
import { Button, Card, Header, Screen, T } from '../components/ui';
import { loadProfile, submitIdentity, VerificationDoc } from '../services/authService';
import { FaceCheckCard, Photo, PhotoCard, useFaceCheck } from '../components/IdentityPhotos';

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

export function VerifyIdentityScreen({ profile, onProfileChange, onLogout }: Props) {
  const [photos, setPhotos] = useState<Partial<Record<VerificationDoc, Photo>>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const face = useFaceCheck(photos.id, photos.selfie);

  const status = profile.verificationStatus;
  // Faculty/staff only submit their ID; students submit ID, COR and selfie
  const isStudent = profile.memberType !== 'faculty';
  const docs = isStudent ? DOCS : [{ ...DOCS[0], title: 'Faculty / Staff ID', hint: 'Front of your DYCI faculty or staff ID' }];

  const submit = async () => {
    const missing = docs.filter((d) => !photos[d.id]);
    if (missing.length) {
      Alert.alert('Photos missing', `Add: ${missing.map((d) => d.title).join(', ')}`);
      return;
    }
    if (isStudent && !face.green) {
      Alert.alert('Face match too low', 'Your selfie must strongly match your ID photo (green). Retake the photos and try again.');
      return;
    }
    if (!consent) {
      Alert.alert('Consent required', 'Please agree to the Data Privacy notice.');
      return;
    }
    setSubmitting(true);
    try {
      onProfileChange(
        await submitIdentity(
          profile.id,
          isStudent
            ? { id: photos.id!.base64, cor: photos.cor!.base64, selfie: photos.selfie!.base64 }
            : { id: photos.id!.base64 },
        ),
      );
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
              {isStudent
                ? 'Add 3 photos. A PedalPass admin compares your selfie with your school ID, then approves your bike pass.'
                : 'Add a photo of your faculty / staff ID. A PedalPass admin checks it, then approves your bike pass.'}
            </T>
          </View>
        </Card>
      )}

      {face.element}
      {docs.map((d) => (
        <PhotoCard
          key={d.id}
          title={d.title}
          hint={d.hint}
          icon={d.icon}
          photo={photos[d.id]}
          selfie={d.id === 'selfie'}
          onChange={(p) => setPhotos((prev) => ({ ...prev, [d.id]: p }))}
        />
      ))}
      {isStudent && <FaceCheckCard check={face.check} onRetry={face.retry} />}

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
            the photos. My selfie and COR are deleted after review; my ID photo is kept while I have a PedalPass
            account so admins can identify who rode a bike.
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

