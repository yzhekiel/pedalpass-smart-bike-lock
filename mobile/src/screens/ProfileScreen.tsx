import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { RideRecord, ScreenType, UserProfile } from '../types';
import { colors } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Divider, Header, KeyValue, Screen, SectionTitle, T } from '../components/ui';

type Props = {
  user: UserProfile;
  rides: RideRecord[];
  hasActiveRide: boolean;
  onNavigate: (screen: ScreenType) => void;
  onLogout: () => void;
};

const STATUS: Record<NonNullable<UserProfile['verificationStatus']>, { label: string; bg: string; fg: string }> = {
  approved: { label: 'Verified', bg: colors.successContainer, fg: colors.success },
  pending_review: { label: 'Waiting for approval', bg: colors.tertiaryContainer, fg: colors.onSurface },
  needs_documents: { label: 'Documents needed', bg: colors.errorContainer, fg: colors.error },
  rejected: { label: 'Not approved', bg: colors.errorContainer, fg: colors.error },
};

/** The signed-in rider's own account, straight from their profile in the database. */
export function ProfileScreen({ user, rides, hasActiveRide, onNavigate, onLogout }: Props) {
  const status = STATUS[user.verificationStatus ?? 'approved'];
  const isStudent = user.memberType === 'student';
  const totalKm = Math.round(rides.reduce((sum, r) => sum + r.distanceKm, 0) * 10) / 10;

  return (
    <Screen header={<Header title="My Profile" subtitle="Account & Identity" onBack={() => onNavigate('home')} />}>
      <Card style={{ alignItems: 'center', gap: 6 }}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <T variant="h1" style={{ color: colors.primary }}>
              {user.name.charAt(0).toUpperCase()}
            </T>
          </View>
        )}
        <T variant="h2" style={{ textAlign: 'center' }}>
          {user.name}
        </T>
        <T variant="small">{user.email}</T>
        <Badge label={status.label} bg={status.bg} fg={status.fg} icon={user.verificationStatus === 'approved' ? 'verified' : 'info'} />
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle icon="assignment_ind">{isStudent ? 'Student Information' : 'Staff Information'}</SectionTitle>
        <KeyValue k="Account" v={isStudent ? 'User • Student' : 'User • Faculty'} />
        {user.studentId ? <KeyValue k={isStudent ? 'Student No.' : 'School ID'} v={user.studentId} /> : null}
        {user.course ? <KeyValue k="Course" v={user.course} /> : null}
        {user.yearLevel ? <KeyValue k="Year Level" v={user.yearLevel} /> : null}
        {user.section ? <KeyValue k="Section" v={user.section} /> : null}
        {user.department ? <KeyValue k="Department" v={user.department} /> : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle icon="pedal_bike">My Rides</SectionTitle>
        <KeyValue k="Completed rides" v={String(rides.length)} />
        <KeyValue k="Total distance" v={`${totalKm} km`} />
        <Divider />
        <Button label="My rides" icon="pedal_bike" variant="outline" onPress={() => onNavigate('ride_history')} />
      </Card>

      {user.verificationStatus === 'rejected' && user.rejectionReason ? (
        <Card style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.errorContainer }}>
          <Icon name="error" size={22} color={colors.error} />
          <View style={{ flex: 1 }}>
            <T variant="h3">Why it was not approved</T>
            <T variant="small">{user.rejectionReason}</T>
          </View>
        </Card>
      ) : null}

      <Button
        label={hasActiveRide ? 'End your ride before logging out' : 'Log out'}
        icon="logout"
        variant="danger"
        disabled={hasActiveRide}
        onPress={onLogout}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceContainer },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
});
