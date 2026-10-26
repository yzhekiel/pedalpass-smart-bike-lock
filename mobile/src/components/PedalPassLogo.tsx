import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type Props = { size?: number; showOuterCard?: boolean };

export function PedalPassLogo({ size = 72, showOuterCard = true }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Defs>
        <LinearGradient id="blueCardGrad" x1="60" y1="20" x2="60" y2="100" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#0B2B7E" />
          <Stop offset="100%" stopColor="#051648" />
        </LinearGradient>
      </Defs>

      {showOuterCard && (
        <Rect x="4" y="4" width="112" height="112" rx="26" fill="#FFFFFF" stroke="#F5A818" strokeWidth="3.2" />
      )}

      <Rect
        x={showOuterCard ? '20' : '6'}
        y={showOuterCard ? '20' : '6'}
        width={showOuterCard ? '80' : '108'}
        height={showOuterCard ? '80' : '108'}
        rx={showOuterCard ? '18' : '24'}
        fill="url(#blueCardGrad)"
      />

      <G
        transform={showOuterCard ? undefined : 'scale(1.22) translate(-11, -11)'}
        stroke="#F5B82E"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* IoT wireless arcs */}
        <Path d="M 47 38 C 55 33, 65 33, 73 38" strokeWidth="1.8" fill="none" />
        <Path d="M 50.5 42 C 56 38.5, 64 38.5, 69.5 42" strokeWidth="1.8" fill="none" />
        <Path d="M 54 45.8 C 57.5 43.5, 62.5 43.5, 66 45.8" strokeWidth="1.8" fill="none" />

        {/* Smart padlock */}
        <Path d="M 55 52 V 49 C 55 45.8, 65 45.8, 65 49 V 52" strokeWidth="2.2" fill="none" />
        <Rect x="51" y="52" width="18" height="16" rx="2.5" fill="#0B2B7E" strokeWidth="2" />
        <Rect x="56" y="56.5" width="8" height="7" rx="1.2" strokeWidth="1.5" fill="none" />
        <Circle cx="60" cy="60" r="1.2" fill="#F5B82E" />

        {/* Wheels */}
        <Circle cx="37" cy="74" r="12" strokeWidth="2.2" fill="none" />
        <Circle cx="37" cy="74" r="9.5" strokeWidth="1.2" fill="none" />
        <Circle cx="37" cy="74" r="2" fill="#F5B82E" />
        <Circle cx="83" cy="74" r="12" strokeWidth="2.2" fill="none" />
        <Circle cx="83" cy="74" r="9.5" strokeWidth="1.2" fill="none" />
        <Circle cx="83" cy="74" r="2" fill="#F5B82E" />

        {/* Frame */}
        <Line x1="37" y1="74" x2="55" y2="76" strokeWidth="2" />
        <Line x1="37" y1="74" x2="49" y2="57" strokeWidth="2" />
        <Ellipse cx="55" cy="76" rx="5" ry="3.5" strokeWidth="1.6" fill="#0B2B7E" />
        <Line x1="55" y1="76" x2="60" y2="82" strokeWidth="2" />
        <Line x1="58" y1="82" x2="63" y2="82" strokeWidth="2.4" />
        <Line x1="55" y1="76" x2="49" y2="54" strokeWidth="2" />
        <Path d="M 43 53 C 45 52, 53 52, 57 53.5 C 55 54.5, 48 55, 43 53 Z" fill="#F5B82E" />
        <Line x1="49" y1="57" x2="72" y2="57" strokeWidth="2" />
        <Line x1="72" y1="57" x2="55" y2="76" strokeWidth="2" />
        <Line x1="72" y1="54" x2="72" y2="60" strokeWidth="2.2" />
        <Line x1="72" y1="60" x2="83" y2="74" strokeWidth="2.2" />
        <Path d="M 72 54 H 76 C 79 54, 80 57, 78 60 C 76 62, 73 61, 73 60" strokeWidth="2" fill="none" />
      </G>
    </Svg>
  );
}
