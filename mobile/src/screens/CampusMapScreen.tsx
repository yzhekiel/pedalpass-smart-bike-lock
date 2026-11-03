import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { BicycleItem, ScreenType } from '../types';
import { colors } from '../theme';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Header, Row, Screen, SectionTitle, T } from '../components/ui';
import { isLowBattery, isReady } from '../services/rideService';

type Props = {
  bikes: BicycleItem[];
  onNavigate: (screen: ScreenType) => void;
};

/**
 * Elida Campus — the part around the PedalPass bike station, drawn from the
 * Elida Campus Directory (Bldg. A & B first floor). Not to scale.
 * Coordinates are in the SVG's 360 × 280 box; edit BUILDINGS to adjust.
 */
const BUILDINGS: { x: number; y: number; w: number; h: number; title: string; sub?: string; fill: string }[] = [
  { x: 78, y: 14, w: 94, h: 40, title: 'BLDG. B', sub: 'Rooms 102–105', fill: '#fbf3d5' },
  { x: 174, y: 14, w: 46, h: 40, title: 'A & B', sub: 'COA • LINKX', fill: '#cfe4f7' },
  { x: 222, y: 14, w: 96, h: 40, title: 'BLDG. A', sub: 'Registrar • Cashier', fill: '#cfe4f7' },
  { x: 78, y: 236, w: 92, h: 30, title: 'FOOD STALLS', fill: '#eef0f3' },
  { x: 196, y: 236, w: 122, h: 30, title: 'SSC • PARAYA • SUST.', fill: '#cfe4f7' },
];

const GATE = { x: 326, y: 14, w: 26, h: 252 };
const COURT = { x: 10, y: 14, w: 60, h: 252 };
const PIN = { x: 40, y: 92 }; // bike station, top of the covered court beside Bldg. B

export function CampusMapScreen({ bikes, onNavigate }: Props) {
  const here = bikes.filter((b) => b.station === 'Covered Court Hub');
  const available = here.filter(isReady);

  return (
    <Screen header={<Header title="Campus Map" subtitle="Elida Campus • Bike Station" onBack={() => onNavigate('home')} />}>
      <Card style={{ padding: 8 }}>
        <View style={{ width: '100%', aspectRatio: 360 / 280 }}>
        <Svg width="100%" height="100%" viewBox="0 0 360 280">
          {/* Courtyard */}
          <Rect x={76} y={58} width={244} height={174} rx={8} fill="#d8efcf" />

          {/* Covered court */}
          <Rect x={COURT.x} y={COURT.y} width={COURT.w} height={COURT.h} rx={6} fill="#dfe3e8" />
          <Rect x={COURT.x + 10} y={COURT.y + 120} width={COURT.w - 20} height={110} fill="none" stroke="#9a8a74" strokeWidth={1.5} />
          <Line x1={COURT.x + 10} y1={COURT.y + 175} x2={COURT.x + COURT.w - 10} y2={COURT.y + 175} stroke="#9a8a74" strokeWidth={1.5} />
          <SvgText
            x={COURT.x + COURT.w / 2}
            y={COURT.y + 205}
            fontSize={9}
            fontWeight="bold"
            fill="#4a5568"
            textAnchor="middle"
            transform={`rotate(-90 ${COURT.x + COURT.w / 2} ${COURT.y + 205})`}
          >
            COVERED COURT
          </SvgText>

          {/* Buildings */}
          {BUILDINGS.map((b) => (
            <G key={b.title}>
              <Rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={b.fill} stroke="#9fb3cf" strokeWidth={1} />
              <SvgText x={b.x + b.w / 2} y={b.y + (b.sub ? b.h / 2 - 2 : b.h / 2 + 3)} fontSize={9} fontWeight="bold" fill="#1d2b45" textAnchor="middle">
                {b.title}
              </SvgText>
              {b.sub && (
                <SvgText x={b.x + b.w / 2} y={b.y + b.h / 2 + 10} fontSize={6.5} fill="#4a5568" textAnchor="middle">
                  {b.sub}
                </SvgText>
              )}
            </G>
          ))}

          {/* Entrance gates */}
          <Rect x={GATE.x} y={GATE.y} width={GATE.w} height={GATE.h} rx={4} fill="#eef0f3" stroke="#9fb3cf" strokeWidth={1} />
          <SvgText
            x={GATE.x + GATE.w / 2}
            y={GATE.y + GATE.h / 2}
            fontSize={9}
            fontWeight="bold"
            fill="#1d2b45"
            textAnchor="middle"
            transform={`rotate(90 ${GATE.x + GATE.w / 2} ${GATE.y + GATE.h / 2})`}
          >
            ENTRANCE GATES
          </SvgText>

          {/* Walking route: entrance → along Bldg. A & B → covered court */}
          <Path
            d={`M ${GATE.x - 4} 150 L 200 150 Q 120 150 ${PIN.x + 22} ${PIN.y + 10}`}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2.5}
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
          <SvgText x={262} y={143} fontSize={8} fill={colors.primary} fontWeight="bold" textAnchor="middle">
            You enter here
          </SvgText>

          {/* Station pin */}
          <Circle cx={PIN.x} cy={PIN.y} r={22} fill={colors.primary} opacity={0.15} />
          <Path
            d={`M ${PIN.x} ${PIN.y + 16} C ${PIN.x - 16} ${PIN.y - 2}, ${PIN.x - 14} ${PIN.y - 20}, ${PIN.x} ${PIN.y - 20} C ${PIN.x + 14} ${PIN.y - 20}, ${PIN.x + 16} ${PIN.y - 2}, ${PIN.x} ${PIN.y + 16} Z`}
            fill={colors.primary}
          />
          <SvgText x={PIN.x} y={PIN.y - 4} fontSize={11} fontWeight="bold" fill="#fff" textAnchor="middle">
            {available.length}
          </SvgText>
          <SvgText x={PIN.x} y={PIN.y + 30} fontSize={7.5} fontWeight="bold" fill={colors.primary} textAnchor="middle">
            BIKES
          </SvgText>
        </Svg>
        </View>
        <T variant="tiny" style={{ textAlign: 'center', marginTop: 4 }}>
          Simplified map of Elida Campus around Bldg. A & B — not to scale.
        </T>
      </Card>

      <Card style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            <Icon name="location_on" size={20} color={colors.primary} />
            <T variant="h3">Covered Court Hub</T>
          </Row>
          <Badge
            label={`${available.length} available`}
            bg={available.length ? colors.successContainer : colors.surfaceContainer}
            fg={available.length ? colors.success : colors.onSurfaceVariant}
          />
        </Row>
        <T variant="small">
          From the entrance gates, walk past Bldg. A and through to Bldg. B. The bike rack is at the Covered Court,
          beside Rooms 102–105.
        </T>
        <Button label="Scan a Bike QR" icon="qr_code_scanner" onPress={() => onNavigate('scan')} />
      </Card>

      <Card style={{ gap: 8 }}>
        <SectionTitle icon="pedal_bike">Bikes at this station</SectionTitle>
        {here.length === 0 && <T variant="small">No bikes are assigned to this station yet.</T>}
        {here.map((b) => (
          <Row key={b.id} gap={10} style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T variant="small" style={{ fontWeight: '800' }}>
                {b.id} • {b.bay}
              </T>
              <T variant="tiny">
                {b.model} • {b.battery}% battery
              </T>
            </View>
            <Badge
              label={b.status === 'available' && isLowBattery(b) ? 'Unavailable' : STATUS_LABEL[b.status]}
              bg={isReady(b) ? colors.successContainer : colors.surfaceContainer}
              fg={isReady(b) ? colors.success : colors.onSurfaceVariant}
            />
          </Row>
        ))}
      </Card>
    </Screen>
  );
}

const STATUS_LABEL: Record<BicycleItem['status'], string> = {
  available: 'Available',
  in_use: 'In use',
  inspection: 'Inspection',
  maintenance: 'Repair',
  locked: 'Locked',
};
