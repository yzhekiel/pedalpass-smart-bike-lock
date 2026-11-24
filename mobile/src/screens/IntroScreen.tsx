import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';

const mascot = require('../../assets/pedalpass-mascot-transparent.png');

export function IntroScreen({ onComplete }: { onComplete: () => void }) {
  const mascotOpacity = useRef(new Animated.Value(0)).current;
  const mascotScale = useRef(new Animated.Value(0.28)).current;
  const mascotX = useRef(new Animated.Value(-320)).current;
  const mascotY = useRef(new Animated.Value(18)).current;
  const trailProgress = useRef(new Animated.Value(0)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandY = useRef(new Animated.Value(18)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const lockupOpacity = useRef(new Animated.Value(1)).current;
  const lockupScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(360),
      Animated.parallel([
        Animated.timing(mascotOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(mascotScale, { toValue: 1, damping: 12, stiffness: 115, mass: 0.8, useNativeDriver: true }),
        Animated.spring(mascotX, { toValue: 0, damping: 13, stiffness: 82, mass: 0.9, useNativeDriver: true }),
        Animated.timing(mascotY, { toValue: 0, duration: 680, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(trailProgress, { toValue: 1, duration: 820, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(brandOpacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(brandY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(1400),
      Animated.parallel([
        Animated.timing(lockupOpacity, { toValue: 0, duration: 520, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lockupScale, { toValue: 0.72, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ]);

    animation.start(({ finished }) => {
      if (finished) onComplete();
    });
    return () => animation.stop();
  }, [brandOpacity, brandY, lockupOpacity, lockupScale, mascotOpacity, mascotScale, mascotX, mascotY, onComplete, taglineOpacity, trailProgress]);

  const trailOpacity = trailProgress.interpolate({
    inputRange: [0, 0.15, 0.72, 1],
    outputRange: [0, 0.9, 0.62, 0],
  });
  const trailScaleX = trailProgress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.25, 1, 0.45],
  });

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Animated.View style={[styles.lockup, { opacity: lockupOpacity, transform: [{ scale: lockupScale }] }]}>
        <Animated.View style={[styles.mascotWrap, { opacity: mascotOpacity, transform: [{ translateX: mascotX }, { translateY: mascotY }, { scale: mascotScale }] }]}>
          <Animated.View
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[styles.trail, { opacity: trailOpacity, transform: [{ scaleX: trailScaleX }] }]}
          >
            <View style={[styles.streak, styles.streakTop]} />
            <View style={[styles.streak, styles.streakMiddle]} />
            <View style={[styles.streak, styles.streakBottom]} />
            <View style={[styles.dustDot, styles.dustDotTop]} />
            <View style={[styles.dustDot, styles.dustDotBottom]} />
          </Animated.View>
          <Image source={mascot} resizeMode="contain" style={styles.mascot} />
        </Animated.View>
        <Animated.View style={{ opacity: brandOpacity, transform: [{ translateY: brandY }] }}>
          <Text style={styles.brand}>PedalPass<Text style={styles.brandDot}>.</Text></Text>
        </Animated.View>
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>Your campus ride, ready when you are</Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9f3' },
  lockup: { alignItems: 'center', marginTop: -24 },
  mascotWrap: { position: 'relative' },
  mascot: { width: 230, height: 230 },
  trail: { position: 'absolute', left: -82, top: 144, width: 112, height: 62, transformOrigin: 'right center' },
  streak: { position: 'absolute', right: 0, borderRadius: 999 },
  streakTop: { top: 3, width: 68, height: 5, backgroundColor: 'rgba(255, 197, 0, 0.72)' },
  streakMiddle: { top: 22, width: 108, height: 7, backgroundColor: 'rgba(0, 86, 199, 0.58)' },
  streakBottom: { top: 43, width: 82, height: 5, backgroundColor: 'rgba(255, 197, 0, 0.5)' },
  dustDot: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(0, 86, 199, 0.36)' },
  dustDotTop: { left: 8, top: 9, width: 9, height: 9 },
  dustDotBottom: { left: 26, bottom: 0, width: 6, height: 6 },
  brand: { marginTop: -18, color: colors.primary, fontSize: 38, fontWeight: '900', letterSpacing: -1.5 },
  brandDot: { color: colors.gold },
  tagline: { marginTop: 10, color: colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
});
