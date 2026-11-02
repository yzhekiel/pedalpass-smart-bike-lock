import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { ScreenType, UserProfile, UserRole } from '../types';
import { colors, radius } from '../theme';
import { PedalPassLogo } from '../components/PedalPassLogo';
import { Icon } from '../components/Icon';
import { Button, Card, Field, Row, Screen, T } from '../components/ui';
import { isSupabaseConfigured } from '../lib/supabase';
import { AuthError, signIn as supabaseSignIn } from '../services/authService';

type Props = {
  onNavigate: (screen: ScreenType) => void;
  onSetRole: (role: UserRole) => void;
  onSignedIn: (profile: UserProfile) => void;
  onNeedsVerification: (email: string) => void;
};

// Demo credentials are only pre-filled while the app runs on mock data
const DEMO_EMAIL = { student: '22-0481@dyci.edu.ph', faculty: 'm.reyes@dyci.edu.ph' };

export function LoginScreen({ onNavigate, onSetRole, onSignedIn, onNeedsVerification }: Props) {
  const [roleTab, setRoleTab] = useState<'student' | 'faculty'>('student');
  const [identifier, setIdentifier] = useState(isSupabaseConfigured ? '' : DEMO_EMAIL.student);
  const [password, setPassword] = useState(isSupabaseConfigured ? '' : 'password123');
  const [remember, setRemember] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  const switchRole = (role: 'student' | 'faculty') => {
    setRoleTab(role);
    if (!isSupabaseConfigured) setIdentifier(DEMO_EMAIL[role]);
  };

  const signIn = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Missing details', 'Enter your school email and password.');
      return;
    }
    if (!isSupabaseConfigured) {
      onSetRole(roleTab);
      onNavigate('home');
      return;
    }
    if (!identifier.includes('@')) {
      Alert.alert('Email required', 'Sign in with the email address you registered with.');
      return;
    }
    setSigningIn(true);
    try {
      onSignedIn(await supabaseSignIn(identifier, password));
    } catch (e) {
      setSigningIn(false);
      if (e instanceof AuthError && e.needsVerification) {
        Alert.alert('Verify your email', e.message, [
          { text: 'Enter code', onPress: () => onNeedsVerification(identifier.trim()) },
        ]);
      } else {
        Alert.alert('Sign in failed', (e as Error).message);
      }
    }
  };

  return (
    <Screen bottomPad={40}>
      <Row style={styles.ribbon}>
        <Row gap={6}>
          <View style={styles.liveDot} />
          <T variant="tiny" style={{ fontWeight: '800', color: colors.primary }}>
            DYCI SMART MOBILITY
          </T>
        </Row>
        <Row gap={4}>
          <Icon name="wifi_tethering" size={15} color={colors.onSurfaceVariant} />
          <T variant="tiny">Online</T>
        </Row>
      </Row>

      <View style={{ alignItems: 'center', gap: 4, marginTop: 8 }}>
        <PedalPassLogo size={92} />
        <T variant="h1" style={{ color: colors.primary, marginTop: 8 }}>
          PedalPass
        </T>
        <T variant="small" style={{ fontWeight: '600', textAlign: 'center' }}>
          Campus Bicycle Access & Usage Management
        </T>
        <T variant="tiny" style={{ color: colors.secondary }}>
          Dr. Yanga's Colleges, Inc. • Bocaue, Bulacan
        </T>
      </View>

      {/* Role switcher */}
      <View style={styles.segment}>
        {(['student', 'faculty'] as const).map((r) => {
          const active = roleTab === r;
          return (
            <Pressable key={r} onPress={() => switchRole(r)} style={[styles.segBtn, active && styles.segBtnActive]}>
              <Icon name={r === 'student' ? 'school' : 'badge'} size={18} color={active ? colors.primary : colors.secondary} />
              <T variant="small" style={{ fontWeight: '800', color: active ? colors.primary : colors.secondary }}>
                {r === 'student' ? 'Student' : 'Faculty / Staff'}
              </T>
            </Pressable>
          );
        })}
      </View>

      <Card style={{ gap: 14 }}>
        <Field
          label="Email Address"
          icon="badge"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="The email you registered with"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          icon="lock"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your portal password"
          secure
        />

        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={() => setRemember(!remember)}>
            <Row gap={6}>
              <Icon
                name={remember ? 'check_box' : 'check_box_outline_blank'}
                size={20}
                color={remember ? colors.primary : colors.outline}
              />
              <T variant="small">Remember this device</T>
            </Row>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Password reset', 'A reset link was sent to your email.')}
          >
            <T variant="small" style={{ color: colors.primary, fontWeight: '700' }}>
              Forgot password?
            </T>
          </Pressable>
        </Row>

        <Button label="Sign In to PedalPass" iconRight="arrow_forward" loading={signingIn} onPress={signIn} />

        <Pressable onPress={() => onNavigate('register')} style={{ alignItems: 'center', paddingVertical: 2 }}>
          <T variant="small" style={{ color: colors.onSurfaceVariant }}>
            New student or faculty?{' '}
            <T variant="small" style={{ color: colors.primary, fontWeight: '800', textDecorationLine: 'underline' }}>
              Create an Account
            </T>
          </T>
        </Pressable>
      </Card>

      <View style={{ alignItems: 'center', gap: 4 }}>
        <Row gap={4}>
          <Icon name="phone_in_talk" size={15} color={colors.error} />
          <T variant="tiny">
            Campus Security Emergency: <T variant="tiny" style={{ fontWeight: '800', color: colors.onSurface }}>Local 104</T>
          </T>
        </Row>
        <T variant="tiny" style={{ color: colors.outline, textAlign: 'center' }}>
          Security, maintenance & admin staff: use the PedalPass web portal.
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryContainer },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    padding: 4,
    borderRadius: radius.md,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  segBtnActive: { backgroundColor: colors.surfaceContainerLowest },
});
