import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Easing, Platform, StyleSheet, View } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title: string, message?: string, buttons?: any[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (buttons && buttons.length > 1) {
      const actionBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
      const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
      if (window.confirm(text)) {
        actionBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
    } else {
      window.alert(text);
      buttons?.[0]?.onPress?.();
    }
  };
}
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BicycleItem, RideRecord, ScreenType, UserProfile } from './src/types';
import { isSupabaseConfigured } from './src/lib/supabase';
import { IdentityDocs, restoreSession, signOut, submitIdentity } from './src/services/authService';
import * as rideService from './src/services/rideService';
import { colors } from './src/theme';
import { BottomNavBar } from './src/components/BottomNavBar';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { ActiveRideScreen } from './src/screens/ActiveRideScreen';
import { RideHistoryScreen } from './src/screens/RideHistoryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { InspectionResult } from './src/components/InspectionSheet';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { VerifyIdentityScreen } from './src/screens/VerifyIdentityScreen';
import { IntroScreen } from './src/screens/IntroScreen';

/** One consistent entrance motion for every signed-in screen. */
function AccountScreenTransition({ children }: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0.88)).current;
  const translateY = useRef(new Animated.Value(4)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 170,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, translateY]);

  return <Animated.View style={[appStyles.accountScreen, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/**
 * PedalPass — Student / Faculty mobile app (Expo).
 * Staff (security, maintenance, admin) use the web portal in ../web.
 *
 * Bikes, rides, reports and SOS alerts are stored in Supabase (src/services/rideService.ts)
 * and shared with the staff web portal.
 */
export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [screen, setScreen] = useState<ScreenType>('login');
  const [bikes, setBikes] = useState<BicycleItem[]>([]);
  const [activeBike, setActiveBike] = useState<BicycleItem | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [rideStartedAt, setRideStartedAt] = useState<number | null>(null);
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [rideDataLoading, setRideDataLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null); // the signed-in user
  const [pendingEmail, setPendingEmail] = useState(''); // waiting for its 6-digit code
  const [pendingDocs, setPendingDocs] = useState<IdentityDocs | null>(null); // sign-up photos, uploaded after the code
  const [swap, setSwap] = useState<{ rideId: string; fromBikeId: string; reason: string } | null>(null); // scanning a replacement bike
  const finishIntro = useCallback(() => setShowIntro(false), []);

  // Leaving the Scan screen cancels a swap that was not finished (the current ride just continues)
  React.useEffect(() => {
    if (screen !== 'scan') setSwap(null);
  }, [screen]);

  const loggedIn = !['login', 'register', 'verify_email', 'verify_identity'].includes(screen);

  // Stay signed in between app launches
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    restoreSession()
      .then((p) => {
        if (p) signedIn(p);
      })
      .catch(() => {});
  }, []);

  // Riders must pass the identity check (school ID + COR + selfie) before using the app
  const signedIn = (p: UserProfile) => {
    setProfile(p);
    const approved = !p.verificationStatus || p.verificationStatus === 'approved';
    setScreen(approved ? 'home' : 'verify_identity');
    if (approved) loadRideData(p.id);
  };

  // Bikes, ride history, and a ride still in progress (e.g. after the app was closed mid-ride)
  const loadRideData = async (userId: string) => {
    setRideDataLoading(true);
    try {
      const [freshBikes, active, history] = await Promise.all([
        rideService.fetchBikes(),
        rideService.fetchActiveRide(userId),
        rideService.fetchRideHistory(userId),
      ]);
      setBikes(freshBikes);
      setRides(history);
      if (active) {
        setActiveBike(active.bike);
        setActiveRideId(active.rideId);
        setRideStartedAt(active.startedAt);
        setScreen('active_ride');
      }
    } catch (e) {
      Alert.alert('Could not load bikes and rides', (e as Error).message);
    } finally {
      setRideDataLoading(false);
    }
  };

  const refreshBikes = () => {
    rideService.fetchBikes().then(setBikes).catch(() => {});
  };

  const logOut = () => {
    signOut();
    setProfile(null);
    setActiveBike(null);
    setActiveRideId(null);
    setRideStartedAt(null);
    setBikes([]);
    setRides([]);
    setRideDataLoading(false);
    setScreen('login');
  };

  const needsVerification = (email: string, docs?: IdentityDocs) => {
    setPendingEmail(email);
    setPendingDocs(docs ?? null);
    setScreen('verify_email');
  };

  // Sign-up step 2 done: upload the requirements from step 1, then continue
  const emailVerified = async (p: UserProfile) => {
    if (pendingDocs) {
      try {
        p = await submitIdentity(p.id, pendingDocs);
      } catch (e) {
        Alert.alert('Photos not uploaded', `${(e as Error).message}\nPlease add your requirements again.`);
      }
      setPendingDocs(null);
    }
    signedIn(p);
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

  /** Called by the Scan screen once the lock opened. `ride` is the ride from start_ride (or swap_bike). */
  const startRide = (bike: BicycleItem, ride: { rideId: string; startedAt: number }) => {
    setActiveBike({ ...bike, status: 'in_use' });
    setActiveRideId(ride.rideId);
    setRideStartedAt(ride.startedAt);
    setBikeStatus(bike.id, 'in_use');
    if (swap) {
      setBikeStatus(swap.fromBikeId, 'inspection');
      setSwap(null);
      if (profile) rideService.fetchRideHistory(profile.id).then(setRides).catch(() => {}); // the swapped-out ride ended
    }
  };

  /** The server swapped bikes but the new lock did not open (and that ride was cancelled): no ride now. */
  const swapAborted = () => {
    setActiveBike(null);
    setActiveRideId(null);
    setRideStartedAt(null);
    setSwap(null);
    if (profile) rideService.fetchRideHistory(profile.id).then(setRides).catch(() => {});
  };

  /**
   * Ends the ride with the condition from the return checklist, then sends any problems to maintenance.
   * Returns false when the ride could not be closed (it stays active).
   */
  const endRide = async (inspection: InspectionResult): Promise<boolean> => {
    if (!activeBike || !rideStartedAt || !activeRideId || !profile) return false;
    const condition = inspection.unsafe ? 'damaged' : inspection.problems.length ? 'minor' : 'good';
    let record: RideRecord;
    try {
      record = await rideService.endRide(activeRideId, condition);
    } catch (e) {
      Alert.alert('Could not end ride', `${(e as Error).message}\nCheck your internet connection and try again.`);
      return false;
    }
    const bike = activeBike;
    setRides((prev) => [record, ...prev]);
    setBikeStatus(bike.id, condition === 'damaged' ? 'maintenance' : condition === 'minor' ? 'inspection' : 'available');
    setActiveBike(null);
    setActiveRideId(null);
    setRideStartedAt(null);

    if (inspection.problems.length > 0) {
      // The return checklist is the rider's only way to report, so offer a retry if sending fails
      const send = async () => {
        try {
          const ticket = await rideService.reportInspection(profile, bike, 'return', inspection, false);
          Alert.alert('Ride ended', `Ticket ${ticket.id} was sent to maintenance. Thank you for reporting!`);
        } catch (e) {
          Alert.alert('Ride ended, report not sent', `${(e as Error).message}\nCheck your internet connection.`, [
            { text: 'Not now', style: 'cancel' },
            { text: 'Try again', onPress: send },
          ]);
        }
      };
      await send();
    }
    refreshBikes(); // the database may hold the bike back for an open ticket even after a good return
    return true;
  };

  /** Throws if the alert could not be saved, so the screen can tell the rider to call instead. */
  const sendSos = async () => {
    if (!profile || !activeBike) throw new Error('No active ride.');
    await rideService.sendSos(profile.id, activeBike.id);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {showIntro ? (
          <IntroScreen onComplete={finishIntro} />
        ) : (
          <>
            {screen === 'login' && (
              <LoginScreen onNavigate={setScreen} onSignedIn={signedIn} onNeedsVerification={needsVerification} />
            )}
            {screen === 'register' && (
              <RegisterScreen onNavigate={setScreen} onSignedIn={signedIn} onNeedsVerification={needsVerification} />
            )}
            {screen === 'verify_email' && (
              <VerifyEmailScreen email={pendingEmail} onNavigate={setScreen} onVerified={emailVerified} />
            )}
            {screen === 'verify_identity' && profile && (
              <VerifyIdentityScreen profile={profile} onProfileChange={signedIn} onLogout={logOut} />
            )}

            {loggedIn && profile && (
              <>
                <AccountScreenTransition key={screen}>
                    {screen === 'home' && (
                      <HomeScreen user={profile} bikes={bikes} rides={rides} loading={rideDataLoading} onNavigate={setScreen} activeBike={activeBike} />
                    )}
                    {screen === 'scan' && (
                      <ScanScreen
                        user={profile}
                        bikes={bikes}
                        hasActiveRide={!!activeBike}
                        onNavigate={setScreen}
                        onStartRide={startRide}
                        onBikesChanged={refreshBikes}
                        swap={swap}
                        onSwapAborted={swapAborted}
                      />
                    )}
                    {screen === 'active_ride' && (
                      <ActiveRideScreen
                        bike={activeBike}
                        startedAt={rideStartedAt}
                        onNavigate={setScreen}
                        onEndRide={endRide}
                        onSos={sendSos}
                        onSwap={(reason) => {
                          if (!activeRideId || !activeBike) return;
                          setSwap({ rideId: activeRideId, fromBikeId: activeBike.id, reason });
                          setScreen('scan');
                        }}
                      />
                    )}
                    {screen === 'ride_history' && (
                      <RideHistoryScreen
                        user={profile}
                        rides={rides}
                        onNavigate={setScreen}
                        activeBike={activeBike}
                        rideStartedAt={rideStartedAt}
                      />
                    )}
                    {screen === 'profile' && (
                      <ProfileScreen
                        user={profile}
                        rides={rides}
                        hasActiveRide={!!activeBike}
                        onNavigate={setScreen}
                        onLogout={logOut}
                      />
                    )}
                </AccountScreenTransition>
                <BottomNavBar current={screen} onNavigate={setScreen} />
              </>
            )}
          </>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const appStyles = StyleSheet.create({
  accountScreen: { flex: 1 },
});
