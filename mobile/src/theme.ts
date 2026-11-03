// PedalPass mobile theme — light and soft: pale grey background, white rounded cards with soft shadows,
// pill-shaped fields and buttons, PedalPass navy (the logo's blue) and DYCI gold as the accent.
export const colors = {
  background: '#f2f3f5',
  surface: '#f2f3f5',
  surfaceBright: '#ffffff',
  surfaceContainerLowest: '#ffffff', // cards
  surfaceContainerLow: '#f7f8fa',
  surfaceContainer: '#eceef2', // fields, chips, inner panels
  surfaceContainerHigh: '#e2e5ea',
  onSurface: '#15171c',
  onSurfaceVariant: '#6b7080',
  outline: '#9aa0ac',
  outlineVariant: '#e4e6eb',

  // PedalPass navy (logo #0B2984): text accents and filled buttons
  primary: '#0b2984',
  primaryFill: '#0b2984',
  onPrimary: '#ffffff',
  primaryContainer: '#1539a2',
  onPrimaryContainer: '#e6ecff',

  // DYCI gold: the main call to action (Scan / Unlock), active highlights
  gold: '#f5b82e',
  onGold: '#1f1500',

  /** Near-black for the floating bottom bar's active tab */
  ink: '#15171c',

  secondary: '#3b4f80',
  secondaryContainer: '#e8edfb',
  onSecondaryContainer: '#22345e',

  tertiary: '#a86f00',
  tertiaryContainer: '#fdf1d6',

  success: '#0f8a5f',
  successContainer: '#e2f6ec',

  error: '#d93a3a',
  errorContainer: '#fde7e7',
  onErrorContainer: '#8f1515',

  scrim: 'rgba(21,23,28,0.45)',
};

export const radius = { sm: 10, md: 16, lg: 24, xl: 28, full: 999 };

export const shadow = {
  shadowColor: '#1a1f36',
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};
