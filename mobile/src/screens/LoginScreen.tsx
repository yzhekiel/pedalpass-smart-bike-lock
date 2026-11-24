import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ScreenType, UserProfile } from '../types';
import { colors, radius } from '../theme';
import { Icon } from '../components/Icon';
import { Field, Row, T } from '../components/ui';
import { isSupabaseConfigured } from '../lib/supabase';
import { AuthError, signIn as supabaseSignIn } from '../services/authService';

const mascot = require('../../assets/pedalpass-mascot-transparent.png');

type Props = {
  onNavigate: (screen: ScreenType) => void;
  onSignedIn: (profile: UserProfile) => void;
  onNeedsVerification: (email: string) => void;
};

export function LoginScreen({ onNavigate, onSignedIn, onNeedsVerification }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const headerHeight = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerCopyOpacity = useRef(new Animated.Value(0)).current;
  const headerCopyY = useRef(new Animated.Value(14)).current;
  // The cyclist faces right, so enter from the left to make it ride forward.
  const mascotX = useRef(new Animated.Value(-240)).current;
  const mascotY = useRef(new Animated.Value(12)).current;
  const mascotScale = useRef(new Animated.Value(0.9)).current;
  const mascotShake = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(headerHeight, {
        toValue: 190,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(headerOpacity, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.sequence([
        Animated.delay(130),
        Animated.parallel([
          Animated.timing(headerCopyOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(headerCopyY, {
            toValue: 0,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(240),
        Animated.parallel([
          Animated.timing(formOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(formY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(250),
        Animated.parallel([
          Animated.spring(mascotX, { toValue: 0, damping: 13, stiffness: 88, mass: 0.86, useNativeDriver: true }),
          Animated.spring(mascotY, { toValue: 0, damping: 12, stiffness: 96, useNativeDriver: true }),
          Animated.spring(mascotScale, { toValue: 1, damping: 13, stiffness: 96, useNativeDriver: true }),
        ]),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [formOpacity, formY, headerCopyOpacity, headerCopyY, headerHeight, headerOpacity, mascotScale, mascotX, mascotY]);

  const shakeMascot = () => {
    mascotShake.stopAnimation(() => {
      mascotShake.setValue(0);
      Animated.sequence([
        Animated.timing(mascotShake, { toValue: 1, duration: 60, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(mascotShake, { toValue: -1, duration: 80, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(mascotShake, { toValue: 0.65, duration: 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(mascotShake, { toValue: -0.4, duration: 65, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(mascotShake, { toValue: 0, duration: 75, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    });
  };

  const mascotRotation = mascotShake.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-5deg', '5deg'],
  });

  const signIn = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert('Not connected', 'Add your Supabase keys to mobile/.env.local and restart the app.');
      return;
    }
    if (!identifier.trim() || !password) {
      Alert.alert('Missing details', 'Enter your school email and password.');
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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View style={[styles.headerClip, { height: headerHeight, opacity: headerOpacity }]}>
            <View style={styles.header}>
              <Animated.View
                style={[styles.headerCopy, { opacity: headerCopyOpacity, transform: [{ translateY: headerCopyY }] }]}
              >
                <Text style={styles.headerBrand}>PedalPass<Text style={{ color: colors.gold }}>.</Text></Text>
                <Text style={styles.headerTagline}>Smart campus rides,{`\n`}right at your fingertips.</Text>
              </Animated.View>
              <Pressable
                onPress={shakeMascot}
                style={styles.headerMascotButton}
                accessibilityRole="button"
                accessibilityLabel="Shake the PedalPass mascot"
              >
                <Animated.Image
                  source={mascot}
                  resizeMode="contain"
                  style={[
                    styles.headerMascot,
                    { transform: [{ translateX: mascotX }, { translateY: mascotY }, { rotate: mascotRotation }, { scale: mascotScale }] },
                  ]}
                />
              </Pressable>
              <View style={styles.headerGlow} />
            </View>
          </Animated.View>

          <Animated.View style={[styles.form, { opacity: formOpacity, transform: [{ translateY: formY }] }]}>
            <View>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in with your registered school account.</Text>
            </View>

            <View style={styles.fields}>
              <Field
                label="Email Address"
                icon="mail"
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="Enter your email address"
                keyboardType="email-address"
              />
              <Field
                label="Password"
                icon="lock"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secure
              />
            </View>

            <Row style={styles.options}>
              <Pressable onPress={() => setRemember(!remember)} hitSlop={8}>
                <Row gap={7}>
                  <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                    {remember && <Icon name="check" size={14} color={colors.onGold} />}
                  </View>
                  <T variant="small" style={styles.optionText}>Keep me signed in</T>
                </Row>
              </Pressable>
              <Pressable onPress={() => Alert.alert('Password reset', 'Ask campus IT or Campus Security (Local 104) to reset your password.')}>
                <T variant="small" style={styles.forgot}>Forgot Password?</T>
              </Pressable>
            </Row>

            <Pressable
              onPress={signIn}
              disabled={signingIn}
              style={({ pressed }) => [styles.loginButton, pressed && styles.loginButtonPressed, signingIn && styles.loginButtonDisabled]}
            >
              {signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>Log In</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>Campus bicycle access</Text>
              <View style={styles.divider} />
            </View>
            <Pressable onPress={() => onNavigate('register')} style={styles.signup}>
              <Text style={styles.signupMuted}>Don't have an account? </Text>
              <Text style={styles.signupLink}>Sign Up</Text>
            </Pressable>
            <View style={styles.securityLine}>
              <Icon name="phone_in_talk" size={15} color={colors.error} />
              <Text style={styles.securityText}>Campus Security Emergency: Local 104</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, paddingBottom: 12 },
  headerClip: { overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  header: { flex: 1, overflow: 'hidden', backgroundColor: colors.primaryFill },
  headerCopy: { position: 'absolute', zIndex: 3, left: 20, top: 30 },
  headerBrand: { color: '#fff', fontSize: 23, fontWeight: '900', letterSpacing: -0.7 },
  headerTagline: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 17, marginTop: 6, fontWeight: '600' },
  headerMascotButton: { position: 'absolute', zIndex: 2, width: 174, height: 174, right: -8, bottom: -20 },
  headerMascot: { width: '100%', height: '100%' },
  headerGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -24, bottom: -64, backgroundColor: 'rgba(255,255,255,0.10)' },
  form: { paddingHorizontal: 22, paddingTop: 18, gap: 14 },
  title: { color: colors.onSurface, fontSize: 23, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { color: colors.onSurfaceVariant, fontSize: 12, marginTop: 4 },
  fields: { gap: 10 },
  options: { justifyContent: 'space-between', gap: 12 },
  checkbox: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1.5, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainer },
  checkboxChecked: { backgroundColor: colors.gold, borderColor: colors.gold },
  optionText: { color: colors.onSurfaceVariant },
  forgot: { color: colors.primary, fontWeight: '800' },
  loginButton: { height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryFill },
  loginButtonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  loginButtonDisabled: { opacity: 0.7 },
  loginText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  dividerText: { fontSize: 10, color: colors.outline, fontWeight: '600' },
  signup: { flexDirection: 'row', alignSelf: 'center', paddingVertical: 1 },
  signupMuted: { color: colors.onSurfaceVariant, fontSize: 12 },
  signupLink: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  securityLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  securityText: { color: colors.onSurfaceVariant, fontSize: 10.5, fontWeight: '600' },
});
