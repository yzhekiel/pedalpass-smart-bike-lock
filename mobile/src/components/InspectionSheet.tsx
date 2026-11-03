import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { colors } from '../theme';
import { Icon } from './Icon';
import { Button, Chip, Field, Row, Sheet, T } from './ui';

/** What the rider checks before borrowing and before returning a bike. */
const PARTS = [
  { name: 'Brakes', hint: 'Both levers stop the wheels firmly' },
  { name: 'Tires', hint: 'Not flat, no cuts or bulges' },
  { name: 'Chain', hint: 'On the gears, not loose or rusty' },
  { name: 'Overall condition', hint: 'Frame, seat, handlebar, lights' },
] as const;

export type InspectionMode = 'borrow' | 'return';

export type InspectionResult = {
  problems: string[]; // part names marked "Problem"
  note: string;
  unsafe: boolean;
};

/** "Pre-ride check: Brakes, Tires — front brake squeaks" (the work order's issue title). */
export function describeInspection(mode: InspectionMode, r: InspectionResult): string {
  const when = mode === 'borrow' ? 'Pre-ride check' : 'Return check';
  const note = r.note.trim() ? ` — ${r.note.trim()}` : '';
  return `${when}: ${r.problems.join(', ')}${r.unsafe ? ' (unsafe to ride)' : ''}${note}`;
}

type Props = {
  visible: boolean;
  mode: InspectionMode;
  bikeId: string;
  busy?: boolean;
  onClose: () => void;
  /** Borrow: `ride` false means the rider wants another bike. Return: `ride` is always false. */
  onDone: (result: InspectionResult, ride: boolean) => void;
};

export function InspectionSheet({ visible, mode, bikeId, busy, onClose, onDone }: Props) {
  const [answers, setAnswers] = useState<Record<string, 'ok' | 'problem'>>({});
  const [note, setNote] = useState('');
  const [unsafe, setUnsafe] = useState(false);

  // Start every inspection fresh
  useEffect(() => {
    if (!visible) return;
    setAnswers({});
    setNote('');
    setUnsafe(false);
  }, [visible]);

  const problems = PARTS.filter((p) => answers[p.name] === 'problem').map((p) => p.name);
  const allAnswered = PARTS.every((p) => answers[p.name]);
  const result: InspectionResult = { problems, note, unsafe: problems.length > 0 && unsafe };
  const set = (part: string, v: 'ok' | 'problem') => setAnswers((a) => ({ ...a, [part]: v }));

  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose}>
      <Row gap={8}>
        <Icon name="fact_check" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <T variant="h3">{mode === 'borrow' ? 'Inspect before you ride' : 'Check the bike before returning'}</T>
          <T variant="tiny">
            {mode === 'borrow'
              ? `Look over ${bikeId} now. Problems you report here are not blamed on you.`
              : `Tell us about anything that went wrong with ${bikeId} during your ride.`}
          </T>
        </View>
      </Row>

      {PARTS.map((p) => (
        <Row key={p.name} gap={8} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T variant="small" style={{ fontWeight: '800' }}>
              {p.name}
            </T>
            <T variant="tiny">{p.hint}</T>
          </View>
          <Chip label="OK" selected={answers[p.name] === 'ok'} activeColor={colors.success} onPress={() => set(p.name, 'ok')} />
          <Chip
            label="Problem"
            selected={answers[p.name] === 'problem'}
            activeColor={colors.error}
            onPress={() => set(p.name, 'problem')}
          />
        </Row>
      ))}

      {problems.length > 0 && (
        <>
          <Field value={note} onChangeText={setNote} placeholder="What is wrong? (optional)" icon="edit_note" autoCapitalize="sentences" />
          <Chip label="Unsafe to ride" icon="dangerous" selected={unsafe} activeColor={colors.error} onPress={() => setUnsafe(!unsafe)} />
        </>
      )}

      {!allAnswered ? (
        <Button label="Check all 4 parts to continue" disabled />
      ) : mode === 'return' ? (
        <Button
          label={problems.length ? 'Report & End Ride' : 'Looks good — End Ride'}
          icon="lock"
          loading={busy}
          onPress={() => onDone(result, false)}
        />
      ) : problems.length === 0 ? (
        <Button label="Looks good — Unlock" icon="lock_open" loading={busy} onPress={() => onDone(result, true)} />
      ) : (
        <>
          <Button label="Report & Choose Another Bike" icon="swap_horiz" loading={busy} onPress={() => onDone(result, false)} />
          {!result.unsafe && (
            <Button label="Report & Ride Anyway" variant="outline" disabled={busy} onPress={() => onDone(result, true)} />
          )}
        </>
      )}
      <Button label="Cancel" variant="ghost" disabled={busy} onPress={onClose} />
    </Sheet>
  );
}
