import React, { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../theme';
import { Icon } from './Icon';

/* ---------- Layout ---------- */

export function Screen({
  children,
  header,
  scroll = true,
  bottomPad = 110,
}: {
  children: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
  bottomPad?: number;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={[styles.row, { gap: 10, flex: 1 }]}>
        {onBack && (
          <Pressable onPress={onBack} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Go back">
            <Icon name="arrow_back" size={22} color={colors.onSurface} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({
  children,
  style,
  gap = 8,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.surfaceContainer, marginVertical: 4 }} />;
}

/* ---------- Text ---------- */

export function T({
  children,
  style,
  variant = 'body',
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny' | 'label';
  numberOfLines?: number;
}) {
  return (
    <Text style={[text[variant], style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children, icon, right }: { children: ReactNode; icon?: string; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Row gap={6} style={{ flex: 1 }}>
        {icon && <Icon name={icon} size={20} color={colors.primary} />}
        <T variant="h3">{children}</T>
      </Row>
      {right}
    </Row>
  );
}

/* ---------- Buttons ---------- */

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'light';

export function Button({
  label,
  onPress,
  icon,
  iconRight,
  variant = 'primary',
  loading,
  disabled,
  style,
  small,
}: {
  label: string;
  onPress?: () => void;
  icon?: string;
  iconRight?: string;
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const v = btnVariants[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && { opacity: 0.7 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : icon ? (
        <Icon name={icon} size={small ? 16 : 20} color={v.fg} />
      ) : null}
      <Text style={[styles.btnText, small && { fontSize: 12 }, { color: v.fg }]}>{label}</Text>
      {iconRight && !loading ? <Icon name={iconRight} size={small ? 16 : 20} color={v.fg} /> : null}
    </Pressable>
  );
}

const btnVariants: Record<BtnVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  outline: { bg: colors.surfaceContainerLowest, fg: colors.onSurface, border: colors.outlineVariant },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.error, fg: '#fff', border: colors.error },
  light: { bg: '#fff', fg: colors.primary, border: '#fff' },
};

export function IconButton({
  icon,
  onPress,
  bg = 'transparent',
  color = colors.onSurfaceVariant,
  dot,
  label,
}: {
  icon: string;
  onPress?: () => void;
  bg?: string;
  color?: string;
  dot?: boolean;
  label?: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.iconBtn, { backgroundColor: bg }]} accessibilityLabel={label}>
      <Icon name={icon} size={22} color={color} />
      {dot && <View style={styles.dot} />}
    </Pressable>
  );
}

/* ---------- Chips / badges ---------- */

export function Badge({
  label,
  bg = colors.gold,
  fg = colors.onGold,
  icon,
}: {
  label: string;
  bg?: string;
  fg?: string;
  icon?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={14} color={fg} />}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  activeColor = colors.primary,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  activeColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: activeColor, borderColor: activeColor },
      ]}
    >
      {icon && <Icon name={icon} size={16} color={selected ? '#fff' : colors.onSurfaceVariant} />}
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Form ---------- */

export function Field({
  label,
  value,
  onChangeText,
  icon,
  placeholder,
  secure,
  multiline,
  keyboardType,
  autoCapitalize = 'none',
  hint,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  icon?: string;
  placeholder?: string;
  secure?: boolean;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  hint?: ReactNode;
}) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: 6 }}>
      {label && <T variant="label">{label}</T>}
      <View style={[styles.inputWrap, multiline && { alignItems: 'flex-start' }]}>
        {icon && <Icon name={icon} size={20} color={colors.secondary} style={multiline ? { marginTop: 12 } : undefined} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.outline}
          secureTextEntry={secure && hidden}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]}
        />
        {secure && (
          <Pressable onPress={() => setHidden(!hidden)} hitSlop={8} accessibilityLabel="Toggle password visibility">
            <Icon name={hidden ? 'visibility' : 'visibility_off'} size={20} color={colors.secondary} />
          </Pressable>
        )}
      </View>
      {hint}
    </View>
  );
}

/* ---------- Stat tile ---------- */

export function StatTile({
  label,
  value,
  sub,
  icon,
  iconColor = colors.primary,
  valueColor = colors.onSurface,
  onPress,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: string;
  iconColor?: string;
  valueColor?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.card, styles.tile]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="tiny" style={{ fontWeight: '600', color: colors.onSurfaceVariant }}>
          {label}
        </T>
        <Icon name={icon} size={18} color={iconColor} />
      </Row>
      <Text style={{ fontSize: 22, fontWeight: '800', color: valueColor, marginTop: 4 }}>{value}</Text>
      {sub ? (
        <T variant="tiny" style={{ marginTop: 2 }}>
          {sub}
        </T>
      ) : null}
    </Pressable>
  );
}

/* ---------- Modal ---------- */

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function KeyValue({ k, v, vStyle }: { k: string; v: ReactNode; vStyle?: StyleProp<TextStyle> }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <T variant="small" style={{ color: colors.onSurfaceVariant }}>
        {k}
      </T>
      <T variant="small" style={[{ fontWeight: '700', flexShrink: 1, textAlign: 'right' }, vStyle]}>
        {v}
      </T>
    </Row>
  );
}

/* ---------- Styles ---------- */

const text = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800', color: colors.onSurface, letterSpacing: -0.3 },
  h2: { fontSize: 19, fontWeight: '800', color: colors.onSurface },
  h3: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  body: { fontSize: 13, color: colors.onSurface, lineHeight: 19 },
  small: { fontSize: 12, color: colors.onSurface, lineHeight: 17 },
  tiny: { fontSize: 11, color: colors.onSurfaceVariant, lineHeight: 15 },
  label: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
    gap: 8,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  headerSub: { fontSize: 11, color: colors.onSurfaceVariant },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(189,203,226,0.6)',
    padding: 14,
    ...shadow,
  },
  tile: { flex: 1, minWidth: '46%', padding: 12, borderRadius: radius.md },
  btn: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSmall: { minHeight: 34, paddingHorizontal: 10, borderRadius: radius.sm },
  btnText: { fontSize: 14, fontWeight: '800' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.onSurface },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: 20,
    gap: 12,
  },
});
