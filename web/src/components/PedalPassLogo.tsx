import React from 'react';

interface PedalPassLogoProps {
  size?: number;
  className?: string;
  showOuterCard?: boolean;
}

export const PedalPassLogo: React.FC<PedalPassLogoProps> = ({
  size = 72,
  className = '',
  showOuterCard = true,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="PedalPass Smart Campus Bicycle Logo"
    >
      <defs>
        {/* Soft shadow for the outer card */}
        <filter id="logo-shadow" x="-10%" y="-10%" width="130%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#0B2984" floodOpacity="0.18" />
        </filter>

        {/* Deep DYCI Navy Blue Gradient */}
        <linearGradient id="blueCardGrad" x1="60" y1="20" x2="60" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0B2B7E" />
          <stop offset="100%" stopColor="#051648" />
        </linearGradient>
      </defs>

      {/* Outer Card with Gold Border (as shown in user upload) */}
      {showOuterCard && (
        <rect
          x="4"
          y="4"
          width="112"
          height="112"
          rx="26"
          fill="#FFFFFF"
          stroke="#F5A818"
          strokeWidth="3.2"
          filter="url(#logo-shadow)"
        />
      )}

      {/* Inner Deep Navy Blue Squircle */}
      <rect
        x={showOuterCard ? "20" : "6"}
        y={showOuterCard ? "20" : "6"}
        width={showOuterCard ? "80" : "108"}
        height={showOuterCard ? "80" : "108"}
        rx={showOuterCard ? "18" : "24"}
        fill="url(#blueCardGrad)"
      />

      {/* Gold Graphic Elements */}
      <g
        transform={showOuterCard ? "translate(0, 0)" : "scale(1.22) translate(-11, -11)"}
        stroke="#F5B82E"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* === 1. TOP WIFI / IOT WIRELESS BROADCAST ARCS === */}
        {/* Outer Wave */}
        <path
          d="M 47 38 C 55 33, 65 33, 73 38"
          strokeWidth="1.8"
          fill="none"
        />
        {/* Middle Wave */}
        <path
          d="M 50.5 42 C 56 38.5, 64 38.5, 69.5 42"
          strokeWidth="1.8"
          fill="none"
        />
        {/* Inner Wave */}
        <path
          d="M 54 45.8 C 57.5 43.5, 62.5 43.5, 66 45.8"
          strokeWidth="1.8"
          fill="none"
        />

        {/* === 2. SMART PADLOCK === */}
        {/* Lock Shackle */}
        <path
          d="M 55 52 V 49 C 55 45.8, 65 45.8, 65 49 V 52"
          strokeWidth="2.2"
          fill="none"
        />

        {/* Lock Body (Square with rounded corners) */}
        <rect
          x="51"
          y="52"
          width="18"
          height="16"
          rx="2.5"
          fill="#0B2B7E"
          strokeWidth="2"
        />

        {/* Center Lock Badge / Chip Symbol */}
        <rect
          x="56"
          y="56.5"
          width="8"
          height="7"
          rx="1.2"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="60" cy="60" r="1.2" fill="#F5B82E" />

        {/* === 3. BICYCLE FRAME & COMPONENTS === */}
        {/* Rear Wheel (Left) - Double concentric circles */}
        <circle cx="37" cy="74" r="12" strokeWidth="2.2" fill="none" />
        <circle cx="37" cy="74" r="9.5" strokeWidth="1.2" fill="none" />
        <circle cx="37" cy="74" r="2" fill="#F5B82E" />

        {/* Front Wheel (Right) - Double concentric circles */}
        <circle cx="83" cy="74" r="12" strokeWidth="2.2" fill="none" />
        <circle cx="83" cy="74" r="9.5" strokeWidth="1.2" fill="none" />
        <circle cx="83" cy="74" r="2" fill="#F5B82E" />

        {/* Rear Stay & Frame Lines */}
        {/* Chainstay: Rear hub to bottom bracket */}
        <line x1="37" y1="74" x2="55" y2="76" strokeWidth="2" />
        {/* Seatstay: Rear hub to seat cluster */}
        <line x1="37" y1="74" x2="49" y2="57" strokeWidth="2" />

        {/* Bottom Bracket & Chainring */}
        <ellipse cx="55" cy="76" rx="5" ry="3.5" strokeWidth="1.6" fill="#0B2B7E" />
        {/* Pedal Arm & Pedal */}
        <line x1="55" y1="76" x2="60" y2="82" strokeWidth="2" />
        <line x1="58" y1="82" x2="63" y2="82" strokeWidth="2.4" />

        {/* Seat Tube & Saddle */}
        <line x1="55" y1="76" x2="49" y2="54" strokeWidth="2" />
        {/* Sleek Racing Saddle */}
        <path
          d="M 43 53 C 45 52, 53 52, 57 53.5 C 55 54.5, 48 55, 43 53 Z"
          fill="#F5B82E"
        />

        {/* Top Tube: Seat cluster forward to head tube */}
        <line x1="49" y1="57" x2="72" y2="57" strokeWidth="2" />

        {/* Down Tube: Head tube to bottom bracket */}
        <line x1="72" y1="57" x2="55" y2="76" strokeWidth="2" />

        {/* Head Tube & Fork */}
        <line x1="72" y1="54" x2="72" y2="60" strokeWidth="2.2" />
        <line x1="72" y1="60" x2="83" y2="74" strokeWidth="2.2" />

        {/* Drop Handlebars on the front */}
        <path
          d="M 72 54 H 76 C 79 54, 80 57, 78 60 C 76 62, 73 61, 73 60"
          strokeWidth="2"
          fill="none"
        />
      </g>
    </svg>
  );
};
