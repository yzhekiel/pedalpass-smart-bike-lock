import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ScreenType, UserProfile } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Chip, Field, Header, Row, Screen, SectionTitle, T } from '../components/ui';
import { IdentityDocs, signUp, submitIdentity } from '../services/authService';
import { scanCor } from '../services/corService';
import { FaceCheckCard, Photo, PhotoCard, useFaceCheck } from '../components/IdentityPhotos';

type Props = {
  onNavigate: (screen: ScreenType) => void;
  onSignedIn: (profile: UserProfile) => void;
  /** Step 2: the requirement photos are uploaded once the email code is verified */
  onNeedsVerification: (email: string, docs: IdentityDocs) => void;
};

const YEARS = [1, 2, 3, 4];
const ordinal = (n: number) => ['1st', '2nd', '3rd', '4th'][n - 1] + ' Year';
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

type ScanField = 'studentId' | 'lastName' | 'firstName' | 'middleName' | 'course' | 'yearLevel' | 'section';

export function RegisterScreen({ onNavigate, onSignedIn, onNeedsVerification }: Props) {
  const [memberType, setMemberType] = useState<'student' | 'faculty'>('student');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState(''); // faculty only
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState<number | null>(null);
  const [section, setSection] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Scan COR: only a scan can set "enrolled"
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [scanIssues, setScanIssues] = useState<string[] | null>(null);
  const [filled, setFilled] = useState<ScanField[]>([]);

  // Identity requirements — the COR photo comes from Scan COR (students) or is picked (faculty)
  const [corPhoto, setCorPhoto] = useState<Photo | null>(null);
  const [idPhoto, setIdPhoto] = useState<Photo | null>(null);
  const [selfie, setSelfie] = useState<Photo | null>(null);
  const [consent, setConsent] = useState(false);
  const face = useFaceCheck(idPhoto, selfie);
  const isStudent = memberType === 'student';

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const checks = useMemo(
    () => [
      { label: '8+ characters', ok: password.length >= 8 },
      { label: 'Uppercase', ok: /[A-Z]/.test(password) },
      { label: 'Number', ok: /\d/.test(password) },
      { label: 'Special symbol', ok: /[^A-Za-z0-9]/.test(password) },
    ],
    [password],
  );
  const strength = checks.filter((c) => c.ok).length;
  const matches = password.length > 0 && password === confirm;
  const strengthLabel = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = strength >= 4 ? colors.success : strength >= 2 ? colors.tertiary : colors.error;

  // A field stays green until the student edits it
  const edit = (field: ScanField, set: (v: string) => void) => (v: string) => {
    set(v);
    setFilled((f) => f.filter((x) => x !== field));
  };
  const green = (field: ScanField) => filled.includes(field);

  const scan = async (fromLibrary: boolean) => {
    const permission = fromLibrary
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', fromLibrary ? 'Allow photo access to choose a picture.' : 'Allow camera access to take the photo.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result = fromLibrary
      ? await ImagePicker.launchImageLibraryAsync(options)
      : await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.back });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    setPreview(asset.uri);
    setScanIssues(null);
    setEnrolled(false);
    setFilled([]);
    setCorPhoto(null);
    setScanning(true);
    try {
      const r = await scanCor(asset.uri, asset.width);
      if (!r.is_cor || r.confidence === 'low') {
        setScanIssues(r.issues.length ? r.issues : [r.is_cor ? 'The photo is too unclear to read.' : 'This does not look like a DYCI COR.']);
        return;
      }
      setCorPhoto({ uri: asset.uri, base64: r.image });
      const next: Partial<Record<ScanField, string>> = {
        studentId: r.student_no ?? '',
        lastName: r.last_name ?? '',
        firstName: r.first_name ?? '',
        middleName: r.middle_name ?? '',
        course: r.course ? r.course.toUpperCase() : '',
        section: r.section ?? '',
      };
      if (next.studentId) setStudentId(next.studentId);
      if (next.lastName) setLastName(titleCase(next.lastName));
      if (next.firstName) setFirstName(titleCase(next.firstName));
      if (next.middleName) setMiddleName(titleCase(next.middleName));
      if (next.course) setCourse(next.course);
      if (next.section) setSection(next.section);
      if (r.year_level && YEARS.includes(r.year_level)) setYearLevel(r.year_level);
      setFilled(
        [
          ...(Object.keys(next) as ScanField[]).filter((k) => next[k]),
          ...(r.year_level && YEARS.includes(r.year_level) ? ['yearLevel' as const] : []),
        ],
      );
      setEnrolled(r.enrolled === true);
      setScanIssues(r.issues.length ? r.issues : null);
    } catch (e) {
      setScanIssues([(e as Error).message]);
    } finally {
      setScanning(false);
    }
  };


  const submit = async () => {
    if (!emailValid) {
      Alert.alert('Check your email', 'Enter a valid email address you can open.');
      return;
    }
    if (memberType === 'faculty' && (!fullName.trim() || !studentId.trim())) {
      Alert.alert('Missing details', 'Full name and school ID are required.');
      return;
    }
    if (memberType === 'student') {
      if (!course) {
        Alert.alert('Course missing', 'Scan your COR — your course is read from it.');
        return;
      }
      if (![lastName, firstName, middleName, studentId, course, section].every((v) => v.trim()) || !yearLevel) {
        Alert.alert('Missing details', 'Fill in every field, or scan your COR to fill them in.');
        return;
      }
      // DYCI student numbers look like 2024-09536 (printed under the photo on the ID)
      if (!/^\d{4}-\d{5}$/.test(studentId.trim())) {
        Alert.alert('Check your Student No.', 'Type it exactly as on your DYCI ID, e.g. 2024-09536.');
        return;
      }
      if (!enrolled) {
        Alert.alert('Enrollment not verified', 'Scan your COR. It must show that you are Enrolled.');
        return;
      }
    }
    if (!idPhoto || (isStudent && (!corPhoto || !selfie))) {
      const missing = [isStudent && !corPhoto && 'COR (scan it above)', !idPhoto && (isStudent ? 'School ID' : 'Faculty / Staff ID'), isStudent && !selfie && 'Selfie'];
      Alert.alert('Requirements missing', `Add: ${missing.filter(Boolean).join(', ')}`);
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
    if (strength < 4) {
      Alert.alert('Weak password', 'Your password must meet all 4 policy criteria.');
      return;
    }
    if (!matches) {
      Alert.alert('Passwords do not match', 'Please re-type your password.');
      return;
    }
    setSubmitting(true);
    try {
      const profile = await signUp({
        email,
        password,
        memberType,
        name: memberType === 'student' ? `${firstName.trim()} ${middleName.trim()} ${lastName.trim()}` : fullName,
        studentId,
        ...(memberType === 'student' ? { course, yearLevel: ordinal(yearLevel!), section } : {}),
      });
      // Faculty/staff only send their ID
      const docs: IdentityDocs = isStudent
        ? { id: idPhoto.base64, cor: corPhoto!.base64, selfie: selfie!.base64 }
        : { id: idPhoto.base64 };
      // profile is null when Supabase emailed a verification code (step 2 uploads the photos)
      if (profile) onSignedIn(await submitIdentity(profile.id, docs));
      else onNeedsVerification(email.trim(), docs);
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Could not create account', (e as Error).message);
    }
  };

  // Step 1 progress: every requirement that is done
  const requirements = isStudent
    ? [
        emailValid,
        [lastName, firstName, middleName, section, course].every((v) => v.trim()) && !!yearLevel && /^\d{4}-\d{5}$/.test(studentId.trim()) && enrolled,
        !!corPhoto,
        !!idPhoto,
        !!selfie,
        face.green,
        consent,
        strength >= 4 && matches,
      ]
    : [emailValid, !!fullName.trim() && !!studentId.trim(), !!idPhoto, consent, strength >= 4 && matches];
  const progress = Math.round((requirements.filter(Boolean).length / requirements.length) * 100);

  return (
    <Screen
      bottomPad={40}
      header={
        <Header
          title="Create Account"
          subtitle="Account & Identity"
          onBack={() => onNavigate('login')}
        />
      }
    >
      {face.element}

      <Card style={{ backgroundColor: colors.surfaceContainerLow, gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            <Icon name="verified_user" size={20} color={colors.primary} />
            <T variant="h3">Step 1 of 2 · Requirements</T>
          </Row>
          <T variant="small" style={{ fontWeight: '800', color: progress === 100 ? colors.success : colors.primary }}>
            {progress}%
          </T>
        </Row>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%`, backgroundColor: progress === 100 ? colors.success : colors.primary }]} />
        </View>
        <T variant="tiny">
          {isStudent
            ? 'Fill in your details and add your COR, school ID and a selfie.'
            : 'Fill in your details and add a photo of your faculty / staff ID.'}{' '}
          Step 2 is the code we email you — then your account goes to a PedalPass admin for approval.
        </T>
      </Card>

      {memberType === 'student' && (
        <Card style={{ gap: 10 }}>
          <SectionTitle icon="document_scanner">Scan COR</SectionTitle>
          <T variant="tiny">
            Take a clear photo of your Certificate of Registration. We read it to fill in your details below, and the
            same photo is sent as your COR requirement.
          </T>
          {preview && <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" />}
          {scanning && (
            <T variant="small" style={{ fontWeight: '700', color: colors.primary }}>
              Scanning...
            </T>
          )}
          {scanIssues && (
            <View style={styles.issues}>
              <T variant="h3">Please retake the photo</T>
              {scanIssues.map((issue) => (
                <T key={issue} variant="small">
                  • {issue}
                </T>
              ))}
            </View>
          )}
          <Row gap={8}>
            <Button
              small
              style={{ flex: 1 }}
              icon="photo_camera"
              label={preview ? 'Retake' : 'Scan COR'}
              loading={scanning}
              onPress={() => scan(false)}
            />
            <Button small style={{ flex: 1 }} icon="image" label="Choose" variant="outline" disabled={scanning} onPress={() => scan(true)} />
          </Row>
        </Card>
      )}

      <Card style={{ gap: 14 }}>
        <Field
          label="Email Address *"
          icon="mail"
          value={email}
          onChangeText={setEmail}
          placeholder="e.g. juan.delacruz@gmail.com"
          keyboardType="email-address"
          hint={
            email.length > 0 ? (
              <Row gap={4}>
                <Icon
                  name={emailValid ? 'task_alt' : 'error_outline'}
                  size={15}
                  color={emailValid ? colors.success : colors.error}
                />
                <T variant="tiny" style={{ color: emailValid ? colors.success : colors.error, fontWeight: '700' }}>
                  {emailValid ? 'Valid email' : 'Enter a valid email address'}
                </T>
              </Row>
            ) : null
          }
        />

        <View style={{ gap: 6 }}>
          <T variant="label">I am a *</T>
          <Row gap={8}>
            {(['student', 'faculty'] as const).map((r) => {
              const active = memberType === r;
              return (
                <Pressable key={r} onPress={() => setMemberType(r)} style={[styles.roleBtn, active && styles.roleBtnActive]}>
                  <Icon name={r === 'student' ? 'school' : 'badge'} size={18} color={active ? '#fff' : colors.secondary} />
                  <T variant="small" style={{ fontWeight: '800', color: active ? '#fff' : colors.secondary }}>
                    {r === 'student' ? 'Student' : 'Faculty'}
                  </T>
                </Pressable>
              );
            })}
          </Row>
          <Row gap={6}>
            <Icon name="shield" size={15} color={colors.outline} />
            <T variant="tiny">Admin accounts are created by campus IT.</T>
          </Row>
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle icon="assignment_ind">Academic Information</SectionTitle>
        {memberType === 'faculty' && (
          <Field label="Full Name" icon="person" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        )}
        {memberType === 'student' && (
          <>
            <Field
              label="Last Name *"
              icon="person"
              value={lastName}
              onChangeText={edit('lastName', setLastName)}
              autoCapitalize="words"
              highlight={green('lastName')}
            />
            <Field
              label="First Name *"
              icon="person"
              value={firstName}
              onChangeText={edit('firstName', setFirstName)}
              autoCapitalize="words"
              highlight={green('firstName')}
            />
            <Field
              label="Middle Name *"
              icon="person"
              value={middleName}
              onChangeText={edit('middleName', setMiddleName)}
              autoCapitalize="words"
              highlight={green('middleName')}
            />
          </>
        )}
        <Field
          label={memberType === 'student' ? 'Student No. (as on your ID)' : 'Employee / School ID No.'}
          icon="pin"
          value={studentId}
          onChangeText={memberType === 'student' ? edit('studentId', setStudentId) : setStudentId}
          placeholder={memberType === 'student' ? 'e.g. 2024-09536' : undefined}
          keyboardType={memberType === 'student' ? 'numbers-and-punctuation' : 'default'}
          highlight={green('studentId')}
        />
        {memberType === 'student' && (
          <>
            {/* Read from the COR — students can't pick it themselves */}
            <View style={{ gap: 6 }}>
              <T variant="label">Course *</T>
              <Row gap={8} style={[styles.readOnly, course ? styles.filledChip : undefined]}>
                <Icon name="auto_stories" size={20} color={course ? colors.success : colors.outline} />
                <T variant="small" style={{ flex: 1, fontWeight: course ? '800' : '400', color: course ? colors.onSurface : colors.outline }}>
                  {course || 'Scan your COR — the course is read from it'}
                </T>
                {course ? <Icon name="lock" size={16} color={colors.success} /> : null}
              </Row>
            </View>
            <View style={{ gap: 6 }}>
              <T variant="label">Year Level *</T>
              <Row gap={6}>
                {YEARS.map((y) => (
                  <View key={y} style={green('yearLevel') && yearLevel === y ? styles.filledChip : undefined}>
                    <Chip
                      label={String(y)}
                      selected={yearLevel === y}
                      onPress={() => {
                        setYearLevel(y);
                        setFilled((f) => f.filter((x) => x !== 'yearLevel'));
                      }}
                    />
                  </View>
                ))}
              </Row>
            </View>
            <Field
              label="Section *"
              icon="groups"
              value={section}
              onChangeText={edit('section', setSection)}
              placeholder="e.g. BSIT-3B"
              autoCapitalize="characters"
              highlight={green('section')}
            />
            <Row gap={8} style={{ justifyContent: 'space-between' }}>
              <T variant="label">Enrollment Status</T>
              <Badge
                label={enrolled ? 'Enrolled ✓' : 'Not Verified'}
                bg={enrolled ? colors.successContainer : colors.errorContainer}
                fg={enrolled ? colors.success : colors.error}
              />
            </Row>
          </>
        )}
      </Card>

      <SectionTitle icon="badge">Identity Requirements</SectionTitle>
      <PhotoCard
        title={isStudent ? 'School ID' : 'Faculty / Staff ID'}
        hint={
          isStudent
            ? 'Front of your DYCI ID, out of the plastic holder if possible'
            : 'Front of your DYCI faculty or staff ID — this is your only requirement'
        }
        icon="badge"
        photo={idPhoto}
        onChange={setIdPhoto}
      />
      {isStudent && (
        <>
          <PhotoCard
            title="Selfie"
            hint="Face the camera in good light, no mask or sunglasses"
            icon="face"
            photo={selfie}
            selfie
            onChange={setSelfie}
          />
          <FaceCheckCard check={face.check} onRetry={face.retry} />
        </>
      )}

      <Pressable onPress={() => setConsent(!consent)}>
        <Card style={{ flexDirection: 'row', gap: 10 }}>
          <Icon
            name={consent ? 'check_box' : 'check_box_outline_blank'}
            size={22}
            color={consent ? colors.primary : colors.outline}
          />
          <T variant="tiny" style={{ flex: 1 }}>
            {isStudent
              ? 'I agree that PedalPass may collect my school ID, COR and selfie only to verify my identity, under the Data Privacy Act of 2012 (RA 10173). My selfie is compared with my ID photo on this phone, and PedalPass admins review the photos before approving me. Only admins can view them. My selfie and COR are deleted after review; my ID photo is kept while I have a PedalPass account so admins can identify who rode a bike.'
              : 'I agree that PedalPass may collect a photo of my ID only to verify my identity, under the Data Privacy Act of 2012 (RA 10173). PedalPass admins review it before approving me. Only admins can view it, and it is kept while I have a PedalPass account so admins can identify who rode a bike.'}
          </T>
        </Card>
      </Pressable>

      <Card style={{ gap: 12 }}>
        <SectionTitle icon="key">Security Credentials</SectionTitle>
        <Field label="Account Password *" icon="lock" value={password} onChangeText={setPassword} secure />
        <Field
          label="Confirm Password *"
          icon="lock"
          value={confirm}
          onChangeText={setConfirm}
          secure
          hint={
            confirm.length > 0 ? (
              <Row gap={4}>
                <Icon name={matches ? 'check_circle' : 'cancel'} size={15} color={matches ? colors.success : colors.error} />
                <T variant="tiny" style={{ color: matches ? colors.success : colors.error, fontWeight: '700' }}>
                  {matches ? 'Passwords match' : 'Passwords do not match'}
                </T>
              </Row>
            ) : null
          }
        />

        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="tiny" style={{ fontWeight: '700' }}>
              Password Strength
            </T>
            <T variant="tiny" style={{ fontWeight: '800', color: strengthColor }}>
              {strengthLabel}
            </T>
          </Row>
          <Row gap={4}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.bar, { backgroundColor: i < strength ? strengthColor : colors.surfaceContainerHigh }]}
              />
            ))}
          </Row>
          <Row gap={10} style={{ flexWrap: 'wrap' }}>
            {checks.map((c) => (
              <Row key={c.label} gap={3}>
                <Icon name={c.ok ? 'check' : 'close'} size={14} color={c.ok ? colors.success : colors.outline} />
                <T variant="tiny">{c.label}</T>
              </Row>
            ))}
          </Row>
        </View>
      </Card>

      <Card style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.secondaryContainer }}>
        <Icon name="mark_email_read" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <T variant="h3">Step 2 · Email Verification</T>
          <T variant="tiny">
            After you submit, a 6-digit code is sent to your email. Enter it to finish — your requirements are then sent
            to campus staff for approval.
          </T>
        </View>
      </Card>

      <Button
        label={submitting ? 'Creating Account...' : 'Submit Requirements & Verify Email'}
        iconRight="arrow_forward"
        loading={submitting}
        onPress={submit}
      />
      <Pressable onPress={() => onNavigate('login')} style={{ alignItems: 'center' }}>
        <T variant="small" style={{ color: colors.onSurfaceVariant }}>
          Already registered?{' '}
          <T variant="small" style={{ color: colors.primary, fontWeight: '800' }}>
            Log in
          </T>
        </T>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  roleBtnActive: { backgroundColor: colors.primaryFill, borderColor: colors.primaryFill },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  preview: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceContainer },
  issues: { gap: 2, padding: 10, borderRadius: radius.md, backgroundColor: colors.errorContainer },
  readOnly: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  filledChip: { borderRadius: radius.md, borderWidth: 2, borderColor: colors.success, backgroundColor: colors.successContainer },
});
