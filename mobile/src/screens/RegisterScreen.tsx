import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { ScreenType, UserProfile, UserRole } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Button, Card, Field, Header, Row, Screen, SectionTitle, T } from '../components/ui';
import { isSupabaseConfigured } from '../lib/supabase';
import { signUp } from '../services/authService';

type Props = {
  onNavigate: (screen: ScreenType) => void;
  onSetRole: (role: UserRole) => void;
  onSignedIn: (profile: UserProfile) => void;
  onNeedsVerification: (email: string) => void;
};

// Sample values only while the app runs on mock data (a real sign-up would email this address)
const demo = (value: string) => (isSupabaseConfigured ? '' : value);

export function RegisterScreen({ onNavigate, onSetRole, onSignedIn, onNeedsVerification }: Props) {
  const [role, setRole] = useState<'student' | 'faculty'>('student');
  const [email, setEmail] = useState(demo('al.santos@dyci.edu.ph'));
  const [fullName, setFullName] = useState(demo('Alexis Gabriel Santos'));
  const [studentId, setStudentId] = useState(demo('2024-00481'));
  const [course, setCourse] = useState(demo('BS in Information Technology'));
  const [yearLevel, setYearLevel] = useState(demo('3rd Year'));
  const [section, setSection] = useState(demo('BSIT 3-A'));
  const [password, setPassword] = useState(demo('DYCI-Pass2025!'));
  const [confirm, setConfirm] = useState(demo('DYCI-Pass2025!'));
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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

  const submit = async () => {
    if (!emailValid) {
      Alert.alert('Check your email', 'Enter a valid email address you can open.');
      return;
    }
    if (!fullName.trim() || !studentId.trim()) {
      Alert.alert('Missing details', 'Full name and school ID are required.');
      return;
    }
    // DYCI student numbers look like 2024-09536 (printed under the photo on the ID)
    if (role === 'student' && !/^\d{4}-\d{5}$/.test(studentId.trim())) {
      Alert.alert('Check your Student No.', 'Type it exactly as on your DYCI ID, e.g. 2024-09536.');
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
    if (!isSupabaseConfigured) {
      timer.current = setTimeout(() => {
        onSetRole(role);
        onNavigate('home');
      }, 1200);
      return;
    }
    try {
      const profile = await signUp({
        email,
        password,
        role,
        name: fullName,
        studentId,
        ...(role === 'student' ? { course, yearLevel, section } : {}),
      });
      // profile is null when Supabase emailed a verification code
      if (profile) onSignedIn(profile);
      else onNeedsVerification(email.trim());
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Could not create account', (e as Error).message);
    }
  };

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
      <Card style={{ backgroundColor: colors.surfaceContainerLow, gap: 6 }}>
        <Row gap={6}>
          <Icon name="verified_user" size={20} color={colors.primary} />
          <T variant="h3">DYCI Identity Check</T>
        </Row>
        <T variant="small">
          Use an email you can open (Gmail, Yahoo or your school email). After signing up you'll add a photo of your{' '}
          <T variant="small" style={{ fontWeight: '800', color: colors.primary }}>
            school ID, COR and a selfie
          </T>{' '}
          so campus staff can confirm you're a DYCI student or faculty.
        </T>
      </Card>

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
          <T variant="label">Select Campus Role *</T>
          <Row gap={8}>
            {(['student', 'faculty'] as const).map((r) => {
              const active = role === r;
              return (
                <Pressable key={r} onPress={() => setRole(r)} style={[styles.roleBtn, active && styles.roleBtnActive]}>
                  <Icon name={r === 'student' ? 'school' : 'badge'} size={18} color={active ? '#fff' : colors.secondary} />
                  <T variant="small" style={{ fontWeight: '800', color: active ? '#fff' : colors.secondary }}>
                    {r === 'student' ? 'Student' : 'Faculty / Staff'}
                  </T>
                </Pressable>
              );
            })}
          </Row>
          <Row gap={6}>
            <Icon name="shield" size={15} color={colors.outline} />
            <T variant="tiny">Administrator and maintenance roles are assigned by campus IT.</T>
          </Row>
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle icon="assignment_ind">Academic Information</SectionTitle>
        <Field label="Full Name" icon="person" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <Field
          label={role === 'student' ? 'Student No. (as on your ID)' : 'Employee / School ID No.'}
          icon="pin"
          value={studentId}
          onChangeText={setStudentId}
          placeholder={role === 'student' ? 'e.g. 2024-09536' : undefined}
          keyboardType={role === 'student' ? 'numbers-and-punctuation' : 'default'}
        />
        {role === 'student' && (
          <>
            <Field label="Course" icon="auto_stories" value={course} onChangeText={setCourse} autoCapitalize="words" />
            <Row gap={10} style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Field label="Year Level" icon="stairs" value={yearLevel} onChangeText={setYearLevel} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Section" icon="groups" value={section} onChangeText={setSection} autoCapitalize="characters" />
              </View>
            </Row>
          </>
        )}
      </Card>

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
          <T variant="h3">Email Verification</T>
          <T variant="tiny">
            After you submit, a 6-digit code is sent to your email. Then you'll add your school ID, COR and a selfie.
          </T>
        </View>
      </Card>

      <Button
        label={submitting ? 'Creating Account...' : 'Create Account & Verify Email'}
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
  roleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  bar: { flex: 1, height: 6, borderRadius: 3 },
});
