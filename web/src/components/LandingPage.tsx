import React, { useEffect } from 'react';
import { PedalPassLogo } from './PedalPassLogo';
import { DyciLogo } from './DyciLogo';
import './LandingPage.css';

interface LandingPageProps {
  onAdminLogin: () => void;
}

const operations = [
  { icon: 'pedal_bike', title: 'Fleet visibility', text: 'See bicycle availability, smart-lock status, and battery health in one place.' },
  { icon: 'shield', title: 'Rider safety', text: 'Keep urgent alerts, active rides, and campus response information within reach.' },
  { icon: 'construction', title: 'Maintenance flow', text: 'Turn rider reports into a clear repair queue and return fixed bikes to service.' },
  { icon: 'monitoring', title: 'Campus insights', text: 'Review ride activity and usage patterns to support better mobility decisions.' },
];

const rideSteps = [
  { icon: 'qr_code_scanner', label: 'Scan', detail: 'Identify the campus bicycle' },
  { icon: 'lock_open', label: 'Unlock', detail: 'Open the connected smart lock' },
  { icon: 'directions_bike', label: 'Ride', detail: 'Travel across campus safely' },
  { icon: 'task_alt', label: 'Return', detail: 'Secure the bicycle for the next rider' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onAdminLogin }) => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('landing-motion-ready');
    const items = document.querySelectorAll<HTMLElement>('.landing-reveal');
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')),
      { threshold: 0.14 },
    );
    items.forEach((item) => observer.observe(item));
    return () => {
      observer.disconnect();
      root.classList.remove('landing-motion-ready');
    };
  }, []);

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="PedalPass home">
          <span className="landing-brand__logo"><PedalPassLogo size={34} showOuterCard={false} /></span>
          <span><strong>PedalPass</strong><small>Smart Campus Bicycle</small></span>
        </a>
        <nav className="landing-nav__links" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#operations">Operations</a>
          <a href="#about">About</a>
        </nav>
        <button className="landing-button landing-button--nav" onClick={onAdminLogin}>
          <span className="material-symbols-outlined">admin_panel_settings</span>
          Admin login
        </button>
      </header>

      <section id="top" className="landing-hero">
        <div className="landing-hero__glow landing-hero__glow--one" />
        <div className="landing-hero__glow landing-hero__glow--two" />
        <div className="landing-hero__copy">
          <div className="landing-kicker landing-entrance landing-entrance--one">
            <span className="landing-kicker__dot" />
            Campus rides, made simple
          </div>
          <h1 className="landing-entrance landing-entrance--two">
            Move around campus with <span>confidence.</span>
          </h1>
          <p className="landing-hero__lead landing-entrance landing-entrance--three">
            PedalPass connects riders, campus bicycles, and smart operations in one dependable mobility system for Dr. Yanga&apos;s Colleges, Inc.
          </p>
          <div className="landing-hero__actions landing-entrance landing-entrance--four">
            <a className="landing-button landing-button--primary" href="#how-it-works">
              <span className="material-symbols-outlined">explore</span>
              Explore PedalPass
            </a>
            <button className="landing-button landing-button--secondary" onClick={onAdminLogin}>
              <span className="material-symbols-outlined">login</span>
              Open Admin Portal
            </button>
          </div>
          <div className="landing-hero__trust landing-entrance landing-entrance--five">
            <span><span className="material-symbols-outlined">school</span>Built for the DYCI campus</span>
            <span><span className="material-symbols-outlined">lock</span>Connected smart locks</span>
          </div>
        </div>

        <div className="landing-hero__visual landing-entrance landing-entrance--visual" aria-label="PedalPass campus rider illustration">
          <div className="landing-orbit landing-orbit--outer" />
          <div className="landing-orbit landing-orbit--inner" />
          <div className="landing-route">
            <span className="landing-route__pin landing-route__pin--start"><span className="material-symbols-outlined">school</span></span>
            <span className="landing-route__line" />
            <span className="landing-route__pin landing-route__pin--finish"><span className="material-symbols-outlined">local_parking</span></span>
          </div>
          <div className="landing-mascot-wrap">
            <img src="/images/pedalpass-app-mascot.png" alt="PedalPass rider cycling on a blue and gold bicycle" className="landing-mascot" />
          </div>
          <div className="landing-float-card landing-float-card--bike">
            <span className="material-symbols-outlined">pedal_bike</span>
            <span><small>Campus mobility</small><strong>Ready to ride</strong></span>
          </div>
          <div className="landing-float-card landing-float-card--lock">
            <span className="material-symbols-outlined">lock_open</span>
            <span><small>Smart access</small><strong>Scan and unlock</strong></span>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section landing-ride">
        <div className="landing-section__heading landing-reveal">
          <span className="landing-section__eyebrow">The rider journey</span>
          <h2>From QR scan to secure return.</h2>
          <p>A focused flow helps students and faculty get moving without unnecessary steps.</p>
        </div>
        <div className="landing-ride__track landing-reveal">
          <div className="landing-ride__progress" />
          {rideSteps.map((step, index) => (
            <article className="landing-step" key={step.label} style={{ '--step-delay': `${index * 90}ms` } as React.CSSProperties}>
              <div className="landing-step__icon"><span className="material-symbols-outlined">{step.icon}</span></div>
              <div><h3>{step.label}</h3><p>{step.detail}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section id="operations" className="landing-section landing-operations">
        <div className="landing-operations__preview landing-reveal">
          <div className="landing-preview__topbar">
            <span className="landing-preview__brand"><PedalPassLogo size={25} showOuterCard={false} /> Operations</span>
            <span className="landing-preview__live"><i /> Live workspace</span>
          </div>
          <div className="landing-preview__body">
            <div className="landing-preview__sidebar">
              {['space_dashboard', 'pedal_bike', 'construction', 'monitoring'].map((icon, index) => (
                <span key={icon} className={index === 0 ? 'is-active' : ''}><span className="material-symbols-outlined">{icon}</span></span>
              ))}
            </div>
            <div className="landing-preview__content">
              <div className="landing-preview__heading"><span><small>Campus overview</small><strong>Good evening, Admin</strong></span><span className="material-symbols-outlined">notifications</span></div>
              <div className="landing-preview__stats">
                <span><i className="landing-preview__icon landing-preview__icon--blue material-symbols-outlined">directions_bike</i><small>Fleet</small><strong>Bike status</strong></span>
                <span><i className="landing-preview__icon landing-preview__icon--gold material-symbols-outlined">battery_charging_full</i><small>Smart locks</small><strong>Battery health</strong></span>
                <span><i className="landing-preview__icon landing-preview__icon--green material-symbols-outlined">verified_user</i><small>Safety</small><strong>Ride oversight</strong></span>
              </div>
              <div className="landing-preview__chart">
                <div className="landing-preview__chart-title"><span><strong>Ride activity</strong><small>Campus usage overview</small></span><span className="material-symbols-outlined">more_horiz</span></div>
                <div className="landing-preview__bars">{[40, 66, 48, 82, 58, 90, 72].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="landing-operations__copy landing-reveal">
          <span className="landing-section__eyebrow">Behind every ride</span>
          <h2>A clearer view for campus operations.</h2>
          <p className="landing-operations__lead">The admin portal brings the daily work of PedalPass into one consistent dashboard.</p>
          <div className="landing-operation-list">
            {operations.map((item) => (
              <article key={item.title}>
                <span className="material-symbols-outlined">{item.icon}</span>
                <div><h3>{item.title}</h3><p>{item.text}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="landing-section landing-about landing-reveal">
        <div className="landing-about__seal"><DyciLogo size={82} /></div>
        <div className="landing-about__copy">
          <span className="landing-section__eyebrow">Designed for DYCI</span>
          <h2>Campus mobility that feels connected to campus life.</h2>
          <p>PedalPass supports a practical bicycle-sharing experience for the Dr. Yanga&apos;s Colleges, Inc. community in Bocaue, Bulacan.</p>
        </div>
        <button className="landing-button landing-button--primary" onClick={onAdminLogin}>
          <span className="material-symbols-outlined">admin_panel_settings</span>
          Continue to Admin Login
        </button>
      </section>

      <footer className="landing-footer">
        <div className="landing-brand">
          <span className="landing-brand__logo"><PedalPassLogo size={30} showOuterCard={false} /></span>
          <span><strong>PedalPass</strong><small>Smart Campus Bicycle</small></span>
        </div>
        <p>Dr. Yanga&apos;s Colleges, Inc. · Bocaue, Bulacan</p>
        <button onClick={onAdminLogin}><span className="material-symbols-outlined">login</span>Admin access</button>
      </footer>
    </main>
  );
};
