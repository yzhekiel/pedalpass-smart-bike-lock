import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RideRecord, ScreenType, UserProfile } from '../types';
import { colors, radius, shadow } from '../theme';
import { Icon } from '../components/Icon';
import { Button, Card, RiderInfoHeader, Row, Screen, T } from '../components/ui';

type Props = {
  user: UserProfile;
  rides: RideRecord[];
  hasActiveRide: boolean;
  onNavigate: (screen: ScreenType) => void;
  onLogout: () => void;
};

const STATUS: Record<
  NonNullable<UserProfile['verificationStatus']>,
  { label: string; message: string; bg: string; fg: string; icon: string }
> = {
  approved: {
    label: 'Verified account',
    message: 'Your identity is verified and your account is ready for campus rides.',
    bg: colors.successContainer,
    fg: colors.success,
    icon: 'verified',
  },
  pending_review: {
    label: 'Review in progress',
    message: 'Your submitted documents are being reviewed by the PedalPass team.',
    bg: colors.tertiaryContainer,
    fg: colors.tertiary,
    icon: 'hourglass_top',
  },
  needs_documents: {
    label: 'Documents needed',
    message: 'Additional identity documents are needed to finish your verification.',
    bg: colors.errorContainer,
    fg: colors.error,
    icon: 'upload_file',
  },
  rejected: {
    label: 'Verification unsuccessful',
    message: 'Review the note below and contact campus staff if you need help.',
    bg: colors.errorContainer,
    fg: colors.error,
    icon: 'error',
  },
};

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Icon name={icon} size={19} color={colors.primary} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

/** The signed-in rider's own account, straight from their profile in the database. */
export function ProfileScreen({ user, rides, hasActiveRide, onNavigate, onLogout }: Props) {
  const status = STATUS[user.verificationStatus ?? 'approved'];
  const isStudent = user.memberType === 'student';
  const totalKm = Math.round(rides.reduce((sum, ride) => sum + ride.distanceKm, 0) * 10) / 10;
  return (
    <Screen
      header={
        <RiderInfoHeader
          name={user.name}
          memberType={user.memberType}
          avatarUrl={user.avatarUrl}
          subtitle="Manage your account and campus ride activity."
        />
      }
    >
      <View style={styles.content}>
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <View style={styles.statIcon}><Icon name="pedal_bike" size={20} color={colors.primary} /></View>
            <Text style={styles.statValue}>{rides.length}</Text>
            <Text style={styles.statLabel}>Completed rides</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={styles.statIcon}><Icon name="route" size={20} color={colors.primary} /></View>
            <Text style={styles.statValue}>{totalKm}</Text>
            <Text style={styles.statLabel}>Kilometers</Text>
          </View>
        </View>

        {user.verificationStatus && user.verificationStatus !== 'approved' ? (
          <View style={[styles.statusCard, { backgroundColor: status.bg }]}>
            <View style={[styles.statusIcon, { backgroundColor: status.fg }]}>
              <Icon name={status.icon} size={21} color="#fff" />
            </View>
            <View style={styles.statusCopy}>
              <Text style={[styles.statusTitle, { color: status.fg }]}>{status.label}</Text>
              <Text style={styles.statusMessage}>{status.message}</Text>
            </View>
          </View>
        ) : null}

        <Card style={styles.infoCard}>
          <Row style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>{isStudent ? 'Student information' : 'Faculty information'}</Text>
            </View>
            <View style={styles.sectionIcon}>
              <Icon name="assignment_ind" size={21} color={colors.primary} />
            </View>
          </Row>
          <View style={styles.detailList}>
            <DetailRow icon="account_circle" label="Account type" value={isStudent ? 'Student' : 'Faculty'} />
            {user.studentId ? <DetailRow icon="badge" label={isStudent ? 'Student number' : 'School ID'} value={user.studentId} /> : null}
            {user.course ? <DetailRow icon="auto_stories" label="Course" value={user.course} /> : null}
            {user.department ? <DetailRow icon="domain" label="Department" value={user.department} /> : null}
          </View>
        </Card>

        <Card style={styles.actionsCard}>
          <View>
            <Text style={styles.sectionTitle}>Manage your activity</Text>
          </View>
          <Button label="View my rides" icon="pedal_bike" variant="outline" onPress={() => onNavigate('ride_history')} />
          <View style={styles.actionDivider} />
          <Button
            label={hasActiveRide ? 'End your ride before logging out' : 'Log out'}
            icon="logout"
            variant="danger"
            disabled={hasActiveRide}
            onPress={onLogout}
          />
          {hasActiveRide ? (
            <T variant="small" style={styles.activeRideNote}>
              Your account stays signed in while a bicycle is active.
            </T>
          ) : null}
        </Card>

        {user.verificationStatus === 'rejected' && user.rejectionReason ? (
          <View style={styles.rejectionCard}>
            <Icon name="error_outline" size={22} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectionTitle}>Verification note</Text>
              <Text style={styles.rejectionMessage}>{user.rejectionReason}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20 },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -16,
    marginHorizontal: 3,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: '#fff',
    ...shadow,
  },
  stat: { flex: 1, alignItems: 'center' },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer },
  statValue: { color: colors.onSurface, fontSize: 22, fontWeight: '900', marginTop: 6 },
  statLabel: { color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '700', marginTop: 1 },
  statDivider: { width: 1, height: 64, backgroundColor: colors.outlineVariant },
  statusCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 18, borderRadius: radius.lg },
  statusIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusCopy: { flex: 1 },
  statusTitle: { fontSize: 14, fontWeight: '900' },
  statusMessage: { color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 17, marginTop: 3 },
  infoCard: { gap: 12, borderWidth: 1, borderColor: colors.outlineVariant },
  sectionHeading: { justifyContent: 'space-between' },
  sectionTitle: { color: colors.onSurface, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  sectionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer },
  detailList: { gap: 0 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  detailIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerLow },
  detailCopy: { flex: 1 },
  detailLabel: { color: colors.onSurfaceVariant, fontSize: 11, fontWeight: '700' },
  detailValue: { color: colors.onSurface, fontSize: 14, fontWeight: '800', marginTop: 2 },
  actionsCard: { gap: 16, borderWidth: 1, borderColor: colors.outlineVariant },
  actionDivider: { height: 1, backgroundColor: colors.outlineVariant },
  activeRideNote: { color: colors.onSurfaceVariant, textAlign: 'center' },
  rejectionCard: { flexDirection: 'row', gap: 14, padding: 18, borderRadius: radius.lg, backgroundColor: colors.errorContainer },
  rejectionTitle: { color: colors.error, fontSize: 14, fontWeight: '900' },
  rejectionMessage: { color: colors.onErrorContainer, fontSize: 12, lineHeight: 17, marginTop: 3 },
});
