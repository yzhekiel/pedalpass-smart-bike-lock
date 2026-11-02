import React, { useState } from 'react';
import { PedalPassLogo } from './PedalPassLogo';
import { isSupabaseConfigured } from '../lib/supabase';
import { StaffProfile, StaffRole, staffSignIn } from '../lib/auth';

interface LoginScreenProps {
  onLogin: (role: StaffRole, profile: StaffProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Not connected. Fill in web/.env with your Supabase keys and restart npm run dev.');
      return;
    }
    if (!identifier.trim().toLowerCase().endsWith('@dyci.edu.ph')) {
      setError('Use your official @dyci.edu.ph staff email.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setSigningIn(true);
    setError('');
    try {
      // The role comes from the database, not from the selected tab
      const profile = await staffSignIn(identifier, password);
      onLogin(profile.role, profile);
    } catch (err) {
      setError((err as Error).message);
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Brand panel (desktop) */}
      <aside className="hidden lg:flex w-[44%] bg-gradient-to-br from-primary to-[#051648] text-on-primary flex-col justify-between p-10">
        <div className="flex items-center gap-3">
          <PedalPassLogo size={56} />
          <div>
            <p className="text-xl font-extrabold">PedalPass</p>
            <p className="text-xs text-on-primary-container">Staff Monitoring Portal</p>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight">
            Monitor campus bicycles, smart locks and rides in one place.
          </h2>
          <ul className="space-y-2 text-sm text-on-primary-container">
            {[
              ['monitoring', 'Live fleet status and active rides'],
              ['notifications_active', 'Tamper, low-battery and late-return alerts'],
              ['build', 'Maintenance work orders and parts inventory'],
              ['assessment', 'Usage reports for administrators'],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed text-[20px]">{icon}</span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-on-primary-container">Dr. Yanga's Colleges, Inc. • Bocaue, Bulacan</p>
      </aside>

      {/* Sign-in form */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 lg:hidden">
            <div className="inline-flex mb-2">
              <PedalPassLogo size={80} />
            </div>
            <h1 className="text-2xl font-extrabold text-primary">PedalPass</h1>
            <p className="text-sm text-on-surface-variant">Staff Monitoring Portal</p>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/50 shadow-sm">
            <h2 className="text-lg font-extrabold text-on-surface">Staff Sign In</h2>
            <p className="text-xs text-on-surface-variant mb-4">
              Your role (security, maintenance or administrator) comes from your account. For campus staff only. Students use the PedalPass mobile app.
            </p>

            <form className="space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5" htmlFor="identifier">
                  Staff Email
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[20px]">
                    badge
                  </span>
                  <input
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 bg-surface text-on-surface text-sm rounded-xl border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                    type="email"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[20px]">
                    lock
                  </span>
                  <input
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 bg-surface text-on-surface text-sm rounded-xl border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs font-bold text-error flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={signingIn}
                className="w-full h-12 bg-primary text-on-primary rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary-container active:scale-[0.98] transition-all shadow-md shadow-primary/20 disabled:opacity-70"
              >
                {signingIn ? 'Signing in…' : 'Sign In'}
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-outline mt-4">
            Accounts for staff are created by campus IT. Emergency: Campus Security Local 104.
          </p>
        </div>
      </main>
    </div>
  );
};
