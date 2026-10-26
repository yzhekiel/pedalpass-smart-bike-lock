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
  const [studentId, setStudentId] = useState(demo('22-0481'));
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

  const emailValid = /^[^\s@]+@dyci\.edu\.ph$/i.test(email.trim());
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
      Alert.alert('School email required', 'Use your official @dyci.edu.ph email address.');
      return;
    }
    if (!fullName.trim() || !studentId.trim()) {
      Alert.alert('Missing details', 'Full name and school ID are required.');
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
          <T variant="h3">Campus Domain Enforcement</T>
        </Row>
        <T variant="small">
          Use your official Dr. Yanga's Colleges, Inc. school email (
          <T variant="small" style={{ fontWeight: '800', color: colors.primary }}>
            @dyci.edu.ph
          </T>
          ).
        </T>
        <Row gap={6}>
          <Icon name="block" size={16} color={colors.error} />
          <T variant="tiny" style={{ flex: 1 }}>
            Personal email domains (@gmail, @yahoo, etc.) are blocked by campus policy.
          </T>
        </Row>
      </Card>

      <Card style={{ gap: 14 }}>
        <Field
          label="Institutional Email *"
          icon="mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          hint={
            <Row gap={4}>
              <Icon
                name={emailValid ? 'task_alt' : 'error_outline'}
                size={15}
                color={emailValid ? colors.success : colors.error}
              />
              <T variant="tiny" style={{ color: emailValid ? colors.success : colors.error, fontWeight: '700' }}>
                {emailValid ? 'Valid DYCI email' : 'Must end with @dyci.edu.ph'}
              </T>
            </Row>
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
        <Field label="School ID Number" icon="pin" value={studentId} onChangeText={setStudentId} />
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
            After you submit, a 6-digit code is sent to your DYCI email to activate your bike pass.
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
