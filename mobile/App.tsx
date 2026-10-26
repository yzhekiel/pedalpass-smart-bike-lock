import React, { useState } from 'react';
import { Alert, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BicycleItem, RideRecord, ScreenType, UserProfile, UserRole, WorkOrderItem } from './src/types';
import { isSupabaseConfigured } from './src/lib/supabase';
import { restoreSession, signOut } from './src/services/authService';
import { BICYCLES, RIDE_HISTORY, USER_PROFILES } from './src/data/mockData';
import { colors } from './src/theme';
import { BottomNavBar } from './src/components/BottomNavBar';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { ActiveRideScreen, BikeCondition } from './src/screens/ActiveRideScreen';
import { RideHistoryScreen } from './src/screens/RideHistoryScreen';
import { ReportIssueScreen } from './src/screens/ReportIssueScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';

/**
 * PedalPass — Student / Faculty mobile app (Expo).
 * Staff (security, maintenance, admin) use the web portal in ../web.
 *
 * Data is local mock data for now. Replace the TODOs with Supabase (src/lib/supabase.ts) so the
 * mobile app and the staff web portal share the same users, bikes, rides and work orders.
 */
export default function App() {
  const [screen, setScreen] = useState<ScreenType>('login');
  const [role, setRole] = useState<UserRole>('student');
  const [bikes, setBikes] = useState<BicycleItem[]>(BICYCLES);
  const [activeBike, setActiveBike] = useState<BicycleItem | null>(null);
  const [rideStartedAt, setRideStartedAt] = useState<number | null>(null);
  const [rides, setRides] = useState<RideRecord[]>(RIDE_HISTORY);
  const [, setTickets] = useState<WorkOrderItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null); // signed-in Supabase user
  const [pendingEmail, setPendingEmail] = useState(''); // waiting for its 6-digit code

  const user = profile ?? (role === 'faculty' ? USER_PROFILES.faculty : USER_PROFILES.student);
  const loggedIn = screen !== 'login' && screen !== 'register' && screen !== 'verify_email';

  // Stay signed in between app launches
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    restoreSession()
      .then((p) => {
        if (p) signedIn(p);
      })
      .catch(() => {});
  }, []);

  const signedIn = (p: UserProfile) => {
    setProfile(p);
    setRole(p.role);
    setScreen('home');
  };

  const needsVerification = (email: string) => {
    setPendingEmail(email);
    setScreen('verify_email');
  };

  // Android hardware back button: go Home instead of closing the app
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'register' || screen === 'verify_email') {
        setScreen('login');
        return true;
      }
      if (loggedIn && screen !== 'home') {
        setScreen('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen, loggedIn]);

  const setBikeStatus = (id: string, status: BicycleItem['status']) =>
    setBikes((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));

  const startRide = (bike: BicycleItem) => {
    // TODO: supabase.rpc("start_ride", { p_bike_id }) — creates the ride and marks the bike in_use
    setActiveBike({ ...bike, status: 'in_use' });
    setRideStartedAt(Date.now());
    setBikeStatus(bike.id, 'in_use');
  };

  const endRide = (condition: BikeCondition) => {
    if (!activeBike || !rideStartedAt) return;
    const mins = Math.max(1, Math.round((Date.now() - rideStartedAt) / 60000));
    const record: RideRecord = {
      id: `SESS-${Date.now().toString().slice(-6)}`,
      bikeId: activeBike.id,
      from: `${activeBike.station} ${activeBike.bay}`,
      to: 'Main Gate Station Bay 04',
      dateLabel: 'Just now',
      durationMin: mins,
      distanceKm: Math.round(mins * 0.25 * 10) / 10,
      status: condition === 'good' ? 'Completed' : 'Issue Reported',
      note: condition === 'minor' ? 'Minor issue noted by rider' : condition === 'damaged' ? 'Rider reported: needs repair' : undefined,
    };
    // TODO: supabase.rpc("end_ride", { p_ride_id, p_condition }) — closes the ride and frees the bike
    setRides((prev) => [record, ...prev]);
    setBikeStatus(activeBike.id, condition === 'damaged' ? 'maintenance' : 'available');
    setActiveBike(null);
    setRideStartedAt(null);
  };

  const openProfile = () => {
    Alert.alert(user.name, `${user.email}\n${user.course ?? user.department ?? ''}`, [
      { text: 'Close', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          if (activeBike) {
            Alert.alert('Active ride', 'End your ride before logging out.');
            return;
          }
          if (profile) signOut();
          setProfile(null);
          setScreen('login');
        },
      },
    ]);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {screen === 'login' && (
          <LoginScreen
            onNavigate={setScreen}
            onSetRole={setRole}
            onSignedIn={signedIn}
            onNeedsVerification={needsVerification}
          />
        )}
        {screen === 'register' && (
          <RegisterScreen
            onNavigate={setScreen}
            onSetRole={setRole}
            onSignedIn={signedIn}
            onNeedsVerification={needsVerification}
          />
        )}
        {screen === 'verify_email' && (
          <VerifyEmailScreen email={pendingEmail} onNavigate={setScreen} onVerified={signedIn} />
        )}
        {screen === 'home' && <HomeScreen user={user} onNavigate={setScreen} activeBike={activeBike} />}
        {screen === 'scan' && (
          <ScanScreen bikes={bikes} hasActiveRide={!!activeBike} onNavigate={setScreen} onStartRide={startRide} />
        )}
        {screen === 'active_ride' && (
          <ActiveRideScreen bike={activeBike} startedAt={rideStartedAt} onNavigate={setScreen} onEndRide={endRide} />
        )}
        {screen === 'ride_history' && <RideHistoryScreen user={user} rides={rides} onNavigate={setScreen} />}
        {screen === 'report_issue' && (
          <ReportIssueScreen
            user={user}
            bikes={bikes}
            defaultBikeId={rides[0]?.bikeId}
            onNavigate={setScreen}
            onSubmitTicket={(t) => {
              setTickets((prev) => [t, ...prev]);
              if (t.priority === 'P1') setBikeStatus(t.bikeId, 'maintenance');
            }}
          />
        )}

        {loggedIn && (
          <BottomNavBar current={screen} hasActiveRide={!!activeBike} onNavigate={setScreen} onProfile={openProfile} />
        )}
      </View>
    </SafeAreaProvider>
  );
}
