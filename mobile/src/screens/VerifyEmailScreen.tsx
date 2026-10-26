import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { ScreenType, UserProfile } from '../types';
import { colors } from '../theme';
import { Icon } from '../components/Icon';
import { Button, Card, Field, Header, Row, Screen, T } from '../components/ui';
import { resendCode, verifyCode } from '../services/authService';

type Props = {
  email: string;
  onNavigate: (screen: ScreenType) => void;
  onVerified: (profile: UserProfile) => void;
};

const RESEND_SECONDS = 60;

export function VerifyEmailScreen({ email, onNavigate, onVerified }: Props) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const digits = code.replace(/\D/g, '');

  const verify = async () => {
    if (digits.length < 6) {
      Alert.alert('Enter the code', 'Type the 6-digit code from the email.');
      return;
    }
    setVerifying(true);
    try {
      onVerified(await verifyCode(email, digits));
    } catch (e) {
      Alert.alert('Could not verify', (e as Error).message);
      setVerifying(false);
    }
  };

  const resend = async () => {
    try {
      await resendCode(email);
      setCooldown(RESEND_SECONDS);
      Alert.alert('Code sent', `A new code was sent to ${email}.`);
    } catch (e) {
      Alert.alert('Could not send', (e as Error).message);
    }
  };

  return (
    <Screen
      bottomPad={40}
      header={<Header title="Verify Your Email" subtitle="Account & Identity" onBack={() => onNavigate('login')} />}
    >
      <Card style={{ alignItems: 'center', gap: 8, backgroundColor: colors.secondaryContainer }}>
        <Icon name="mark_email_read" size={40} color={colors.primary} />
        <T variant="small" style={{ textAlign: 'center' }}>
          We sent a 6-digit code to
        </T>
        <T variant="h3" style={{ textAlign: 'center' }}>
          {email}
        </T>
        <T variant="tiny" style={{ textAlign: 'center' }}>
          Open Outlook (your DYCI email). If you don't see it, check the Junk folder.
        </T>
      </Card>

      <Card style={{ gap: 14 }}>
        <Field
          label="Verification Code"
          icon="pin"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))}
          placeholder="123456"
          keyboardType="number-pad"
        />
        <Button label="Verify & Continue" iconRight="arrow_forward" loading={verifying} onPress={verify} />
      </Card>

      <View style={{ alignItems: 'center' }}>
        {cooldown > 0 ? (
          <T variant="small" style={{ color: colors.onSurfaceVariant }}>
            Didn't get it? Resend in {cooldown}s
          </T>
        ) : (
          <Pressable onPress={resend}>
            <Row gap={4}>
              <Icon name="refresh" size={16} color={colors.primary} />
              <T variant="small" style={{ color: colors.primary, fontWeight: '800' }}>
                Resend code
              </T>
            </Row>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}
