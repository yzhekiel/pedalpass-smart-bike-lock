import React, { useState } from 'react';
import { PedalPassLogo } from './PedalPassLogo';
import './LoginScreen.css';
import { isSupabaseConfigured } from '../lib/supabase';
import { StaffProfile, StaffRole, staffSignIn } from '../lib/auth';

interface LoginScreenProps {
  onLogin: (role: StaffRole, profile: StaffProfile) => void;
  onBack: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onBack }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
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
      const profile = await staffSignIn(identifier, password);
      onLogin(profile.role, profile);
    } catch (signInError) {
      setError((signInError as Error).message);
      setSigningIn(false);
    }
  };

  return (
    <main className="account-login">
      <div className="account-login__glow account-login__glow--blue" />
      <div className="account-login__glow account-login__glow--gold" />

      <section className="account-login__shell" aria-label="PedalPass administrator sign in">
        <div className="account-login__form-panel">
          <header className="account-login__brand">
            <div className="account-login__brand-lockup">
              <span className="account-login__logo"><PedalPassLogo size={34} showOuterCard={false} /></span>
              <span><strong>PedalPass</strong><small>Admin Portal</small></span>
            </div>
            <button type="button" className="account-login__back" onClick={onBack}>
              <span className="material-symbols-outlined">home</span>
              Website
            </button>
          </header>

          <div className="account-login__form-wrap">
            <div className="account-login__eyebrow">
              <span className="material-symbols-outlined">admin_panel_settings</span>
              Administrator access
            </div>
            <h1>Sign in to your account</h1>
            <p className="account-login__intro">Manage campus bicycles, rider safety, maintenance, and reports.</p>

            <form className="account-login__form" onSubmit={handleSignIn}>
              <div className="account-login__field">
                <label htmlFor="identifier">Admin email</label>
                <div className="account-login__input-wrap">
                  <span className="material-symbols-outlined" aria-hidden="true">alternate_email</span>
                  <input
                    id="identifier"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    type="email"
                    autoComplete="username"
                    placeholder="admin@dyci.edu.ph"
                  />
                </div>
              </div>

              <div className="account-login__field">
                <label htmlFor="password">Password</label>
                <div className="account-login__input-wrap">
                  <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                  <input
                    id="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="account-login__visibility"
                  >
                    <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="account-login__error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={signingIn} className="account-login__submit">
                <span className={`material-symbols-outlined ${signingIn ? 'account-login__spinner' : ''}`}>
                  {signingIn ? 'progress_activity' : 'login'}
                </span>
                {signingIn ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

          </div>
        </div>

        <aside className="account-login__mascot-panel">
          <div className="account-login__grid" />
          <div className="account-login__mascot-copy">
            <span className="account-login__status"><i /> Campus mobility operations</span>
            <h2>Keep every campus ride moving.</h2>
            <p>One secure workspace for the entire PedalPass bicycle network.</p>
          </div>
          <div className="account-login__mascot-halo" />
          <img src="/images/pedalpass-app-mascot.png" alt="PedalPass campus rider mascot" className="account-login__mascot" />
        </aside>
      </section>
    </main>
  );
};
