import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { BicycleItem, ScreenType, UserProfile, WorkOrderItem } from '../types';
import { colors } from '../theme';
import { Icon } from '../components/Icon';
import { Button, Card, Chip, Field, Header, Row, Screen, T } from '../components/ui';

type Props = {
  user: UserProfile;
  bikes: BicycleItem[];
  defaultBikeId?: string;
  onNavigate: (screen: ScreenType) => void;
  onSubmitTicket: (ticket: WorkOrderItem) => void;
};

const COMPONENTS = [
  'Flat Tire',
  'Brakes',
  'Smart Lock / Won’t Unlock',
  'Chain Slip',
  'Damaged Frame',
  'QR Code Unreadable',
  'Other',
];

const PRIORITY_LABEL = {
  P1: 'High Priority (P1)',
  P2: 'Medium Priority (P2)',
  P3: 'Low Priority (P3)',
} as const;

export function ReportIssueScreen({ user, bikes, defaultBikeId, onNavigate, onSubmitTicket }: Props) {
  const [bikeId, setBikeId] = useState(defaultBikeId ?? bikes[0]?.id ?? '');
  const [component, setComponent] = useState(COMPONENTS[0]);
  const [severity, setSeverity] = useState<'P1' | 'P2' | 'P3'>('P2');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const bike = bikes.find((b) => b.id === bikeId);

  const submit = () => {
    if (!bike) {
      Alert.alert('Choose a bicycle', 'Select which bike has the problem.');
      return;
    }
    if (description.trim().length < 5) {
      Alert.alert('Add details', 'Describe the problem in a few words.');
      return;
    }
    setSending(true);
    // TODO: insert into the Supabase "work_orders" table so maintenance staff see it on the web portal
    const ticket: WorkOrderItem = {
      id: `TKT-${Math.floor(100 + Math.random() * 900)}`,
      bikeId: bike.id,
      station: bike.station,
      bay: bike.bay,
      priority: severity,
      priorityLabel: PRIORITY_LABEL[severity],
      issueTitle: `${component}${description ? ` — ${description.trim()}` : ''}`,
      reportedBy: `${user.name} (${user.role === 'faculty' ? 'Faculty' : 'Student'})`,
      timestamp: 'Just now',
      status: 'Reported / Queued',
      nodeId: bike.nodeId,
    };
    setTimeout(() => {
      onSubmitTicket(ticket);
      setSending(false);
      Alert.alert('Report sent', `Ticket ${ticket.id} was sent to the maintenance team. Thank you!`, [
        { text: 'OK', onPress: () => onNavigate('home') },
      ]);
    }, 800);
  };

  return (
    <Screen header={<Header title="Report an Issue" subtitle="Help keep campus bikes safe" onBack={() => onNavigate('home')} />}>
      <Card style={{ gap: 10 }}>
        <T variant="label">Which bicycle?</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {bikes.map((b) => (
            <Chip key={b.id} label={b.id} icon="pedal_bike" selected={bikeId === b.id} onPress={() => setBikeId(b.id)} />
          ))}
        </Row>
        {bike && (
          <T variant="tiny">
            {bike.model} • {bike.station} ({bike.bay})
          </T>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <T variant="label">What is the problem?</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {COMPONENTS.map((c) => (
            <Chip key={c} label={c} selected={component === c} onPress={() => setComponent(c)} />
          ))}
        </Row>
      </Card>

      <Card style={{ gap: 10 }}>
        <T variant="label">How serious is it?</T>
        <Row gap={8}>
          <Chip label="Low" selected={severity === 'P3'} activeColor={colors.secondary} onPress={() => setSeverity('P3')} />
          <Chip label="Medium" selected={severity === 'P2'} activeColor={colors.tertiary} onPress={() => setSeverity('P2')} />
          <Chip label="Unsafe to ride" selected={severity === 'P1'} activeColor={colors.error} onPress={() => setSeverity('P1')} />
        </Row>
        <T variant="tiny">
          {severity === 'P1'
            ? 'The bike will be locked out from borrowing until a technician checks it.'
            : 'The bike stays available until maintenance reviews the report.'}
        </T>
      </Card>

      <Card style={{ gap: 10 }}>
        <Field
          label="Details"
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what happened, noises, or damage..."
          multiline
          autoCapitalize="sentences"
        />
      </Card>

      <Button label="Submit Report" icon="send" loading={sending} onPress={submit} />
      <View style={{ alignItems: 'center' }}>
        <Row gap={4}>
          <Icon name="phone_in_talk" size={15} color={colors.error} />
          <T variant="tiny">Emergency? Call Campus Security, Local 104</T>
        </Row>
      </View>
    </Screen>
  );
}
