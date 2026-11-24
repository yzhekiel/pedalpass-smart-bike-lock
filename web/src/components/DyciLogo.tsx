import React from 'react';

interface DyciLogoProps {
  className?: string;
  size?: number;
}

export const DyciLogo: React.FC<DyciLogoProps> = ({ className = '', size = 64 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Dr. Yanga's Colleges, Inc. Official Seal"
    >
      {/* Outer Golden Rim */}
      <circle cx="100" cy="100" r="98" fill="#F5B82E" stroke="#D3971B" strokeWidth="2" />

      {/* Royal Navy Blue Ring */}
      <circle cx="100" cy="100" r="91" fill="#0B2984" stroke="#F5B82E" strokeWidth="2.5" />

      {/* Inner Golden Rim */}
      <circle cx="100" cy="100" r="69" fill="#F5B82E" stroke="#0B2984" strokeWidth="1.5" />

      {/* Inner Central Field */}
      <circle cx="100" cy="100" r="66" fill="#F9C348" />

      {/* Text Path on Outer Blue Ring: DR. YANGA'S COLLEGES, INC. */}
      <path id="top-curve" d="M 22 100 A 78 78 0 0 1 178 100" fill="none" />
      <path id="bottom-curve" d="M 175 106 A 78 78 0 0 1 25 106" fill="none" />

      <text fill="#FFFFFF" fontSize="12.5" fontWeight="900" letterSpacing="1.2" fontFamily="system-ui, sans-serif">
        <textPath href="#top-curve" startOffset="50%" textAnchor="middle">
          DR. YANGA'S COLLEGES, INC.
        </textPath>
      </text>

      <text fill="#FFFFFF" fontSize="11" fontWeight="800" letterSpacing="1.8" fontFamily="system-ui, sans-serif">
        <textPath href="#bottom-curve" startOffset="50%" textAnchor="middle">
          BOCAUE, BULACAN
        </textPath>
      </text>
      <circle cx="35" cy="132" r="2.5" fill="#F5B82E" />
      <circle cx="165" cy="132" r="2.5" fill="#F5B82E" />

      {/* Center White Shield / Cross */}
      {/* Horizontal Bar */}
      <rect x="52" y="88" width="96" height="20" fill="#FFFFFF" rx="2" stroke="#0B2984" strokeWidth="1.2" />
      {/* Vertical Stem */}
      <rect x="88" y="88" width="24" height="66" fill="#FFFFFF" rx="2" stroke="#0B2984" strokeWidth="1.2" />

      {/* 1950 Foundation Year on Central Cross */}
      <text
        x="100"
        y="102"
        fill="#0B2984"
        fontSize="11"
        fontWeight="900"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
      >
        1950
      </text>

      {/* Simple golden markers flanking 1950 */}
      <circle cx="64" cy="99" r="2.6" fill="#F5B82E" />
      <circle cx="73" cy="99" r="2.6" fill="#F5B82E" />
      <circle cx="127" cy="99" r="2.6" fill="#F5B82E" />
      <circle cx="136" cy="99" r="2.6" fill="#F5B82E" />

      {/* Simple markers down the stem */}
      <circle cx="100" cy="115" r="2.8" fill="#F5B82E" />
      <circle cx="100" cy="129" r="2.8" fill="#F5B82E" />
      <circle cx="100" cy="143" r="2.8" fill="#F5B82E" />

      {/* Open Book of Knowledge (Top) */}
      <g transform="translate(76, 44)">
        <path
          d="M 24 16 C 18 12, 6 12, 0 16 L 0 32 C 6 28, 18 28, 24 32 C 30 28, 42 28, 48 32 L 48 16 C 42 12, 30 12, 24 16 Z"
          fill="#FFFFFF"
          stroke="#0B2984"
          strokeWidth="1.5"
        />
        <line x1="24" y1="16" x2="24" y2="32" stroke="#0B2984" strokeWidth="1.5" />
      </g>

      {/* Caduceus / Staff of Hermes (Left Quadrant) */}
      <g transform="translate(62, 114)">
        <line x1="10" y1="0" x2="10" y2="28" stroke="#0B2984" strokeWidth="2" />
        <circle cx="10" cy="0" r="2.5" fill="#0B2984" />
        <path d="M 5 6 C 15 10, 15 16, 5 20" stroke="#0B2984" strokeWidth="1.2" fill="none" />
        <path d="M 15 6 C 5 10, 5 16, 15 20" stroke="#0B2984" strokeWidth="1.2" fill="none" />
      </g>

      {/* Torch of Learning (Right Quadrant) */}
      <g transform="translate(122, 114)">
        {/* Flame */}
        <path
          d="M 9 2 C 7 6, 10 10, 9 14 C 13 11, 14 6, 9 2 Z"
          fill="#E53935"
          stroke="#0B2984"
          strokeWidth="0.8"
        />
        <path
          d="M 8 5 C 6 8, 8 11, 8 13 C 10 11, 11 8, 8 5 Z"
          fill="#F5B82E"
        />
        {/* Torch Body */}
        <polygon points="6,14 12,14 10,26 8,26" fill="#0B2984" />
      </g>
    </svg>
  );
};
