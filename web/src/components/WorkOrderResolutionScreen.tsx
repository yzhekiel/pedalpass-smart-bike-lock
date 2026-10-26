import React, { useState } from 'react';
import { ScreenType, WorkOrderItem } from '../types';

interface WorkOrderResolutionScreenProps {
  order: WorkOrderItem;
  onNavigate: (screen: ScreenType) => void;
  onResolveOrder: (orderId: string) => void;
}

export const WorkOrderResolutionScreen: React.FC<WorkOrderResolutionScreenProps> = ({
  order,
  onNavigate,
  onResolveOrder,
}) => {
  const [checklist, setChecklist] = useState({
    brakePads: true,
    rotorTrued: true,
    tirePressure: true,
    chainLubed: true,
    stemTorqued: true,
  });

  const [hardwareTesting, setHardwareTesting] = useState(false);
  const [hardwarePassed, setHardwarePassed] = useState(true);
  const [techNotes, setTechNotes] = useState(
    'Replaced caliper friction pads with Shimano B01S genuine replacements. Swapped depleted 18650 lithium cell in lock head. Solenoid latch alignment checked.'
  );

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTestHardware = () => {
    setHardwareTesting(true);
    setTimeout(() => {
      setHardwareTesting(false);
      setHardwarePassed(true);
      alert('IoT Hardware Handshake Successful: Solenoid 44ms, Hall Sensor 3.3V, Battery 4.18V.');
    }, 1200);
  };

  const handleSignOff = () => {
    onResolveOrder(order.id);
    alert(`Work Order ${order.id} resolved! BP-014 returned to active campus fleet via central MQTT broadcast.`);
    onNavigate('maintenance');
  };

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center selection:bg-primary selection:text-on-primary font-body-md text-sm pb-24">
      <div className="w-full max-w-[640px] flex flex-col min-h-screen bg-surface-bright shadow-sm border-x border-surface-container">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('maintenance')}
              aria-label="Go Back"
              className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-transform"
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <div>
              <h1 className="text-base font-bold text-on-surface">Work Order Resolution</h1>
              <p className="text-[11px] text-primary font-bold">WO #{order.id} • {order.bikeId}</p>
            </div>
          </div>
          <span className="text-xs bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full border border-primary/20">
            Bench Sign-Off
          </span>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-6 py-4 space-y-4">
          {/* Target Bike Banner */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-primary-fixed text-on-primary-fixed px-2 py-0.5 rounded">
                  {order.bikeId}
                </span>
                <span className="text-xs text-on-surface-variant">{order.station} ({order.bay})</span>
              </div>
              <h2 className="text-sm font-extrabold text-on-surface mt-1">{order.issueTitle}</h2>
              <p className="text-[11px] text-on-surface-variant">Lead Tech: {order.assignedTech || 'Kuya Noel B.'}</p>
            </div>
            <span className="material-symbols-outlined text-primary text-[32px]">task_alt</span>
          </section>

          {/* Mechanical Inspection Checklist */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">checklist</span>
                <h3 className="text-sm font-bold text-on-surface">Physical Mechanical Inspection</h3>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                5/5 Completed
              </span>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-container cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checklist.brakePads}
                  onChange={() => toggleCheck('brakePads')}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <span className="text-xs text-on-surface font-medium">Brake pads replaced & caliper centered</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-container cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checklist.rotorTrued}
                  onChange={() => toggleCheck('rotorTrued')}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <span className="text-xs text-on-surface font-medium">Disc rotor trued (zero drag or rubbing)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-container cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checklist.tirePressure}
                  onChange={() => toggleCheck('tirePressure')}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <span className="text-xs text-on-surface font-medium">Tire pressure checked & inflated (45 PSI)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-container cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checklist.chainLubed}
                  onChange={() => toggleCheck('chainLubed')}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <span className="text-xs text-on-surface font-medium">Drivetrain cleaned & PTFE chain lubricant applied</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-container cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checklist.stemTorqued}
                  onChange={() => toggleCheck('stemTorqued')}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <span className="text-xs text-on-surface font-medium">Handlebars & stem bolts torqued to 5 Nm</span>
              </label>
            </div>
          </section>

          {/* Arduino IoT Lock & Bay Hardware Handshake */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">memory</span>
                <h3 className="text-sm font-bold text-on-surface">Arduino IoT Lock & Bay Hardware Handshake</h3>
              </div>
              <span className="text-[10px] text-primary font-bold">Node: {order.nodeId}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-surface-container-low rounded-xl space-y-0.5">
                <span className="text-[10px] text-on-surface-variant">Solenoid Actuation</span>
                <div className="font-bold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check</span> Verified (44ms)
                </div>
              </div>
              <div className="p-2.5 bg-surface-container-low rounded-xl space-y-0.5">
                <span className="text-[10px] text-on-surface-variant">Hall Effect A3144</span>
                <div className="font-bold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check</span> Locked Signal High
                </div>
              </div>
              <div className="p-2.5 bg-surface-container-low rounded-xl space-y-0.5">
                <span className="text-[10px] text-on-surface-variant">Smart Lock Battery</span>
                <div className="font-bold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">battery_full</span> 4.18V (New Cell)
                </div>
              </div>
              <div className="p-2.5 bg-surface-container-low rounded-xl space-y-0.5">
                <span className="text-[10px] text-on-surface-variant">IoT Mesh Gateway</span>
                <div className="font-bold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">wifi</span> Online (-52 dBm)
                </div>
              </div>
            </div>

            <button
              onClick={handleTestHardware}
              disabled={hardwareTesting}
              className="w-full py-2 bg-surface-container text-primary font-bold text-xs rounded-xl hover:bg-surface-container-high transition-colors"
            >
              {hardwareTesting ? 'Re-testing Solenoid & Hall Sensor...' : 'Re-test Solenoid & Hall Sensor'}
            </button>
          </section>

          {/* Proof of Service Photos */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-2.5">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Visual Verification Photos (2)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl overflow-hidden border border-outline-variant/50 relative">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA2hQ2K-vaZTxDoEMExf2Vgmb7hYL-dvhRhoz1kb2ZE1JCFDflZFSTxAHhTmEqVMi_i04YWoxGbjuG4CV7Zx09no8veqLWF8hDdVWPrEa4m5nZD9gz9ZVNQCKFCYG1ldbMhv4dz7LkHCD4c2k5qT3LLtAB1JKuja-HkJkKrQHL7qDUw1Ss91h-RI_TPz2dvqfgV_9xP1JyF2muuOdBvCp2U2USAYfa8f2NG4T-mKTGp1t2dLyNt9HatrA"
                  alt="Brake Caliper Serviced"
                  referrerPolicy="no-referrer"
                  className="w-full h-24 object-cover"
                />
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.2 rounded font-mono">
                  Brake Caliper Serviced
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-outline-variant/50 relative">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBpbEaOlC9wNYHZolanT13XTTzyNBJk4l5LAFrV5MIxysvjEi1HnHCQjTTKs2PQBV-jdmWzeviOgwRYhWeeISWxXOTlBPP55MVD7sb9pLxOYWcWDK3ALDpeUJMt6X_wiU4JpKqJwwyE6GSrlCO-u099CAC-WeGvuEz-lrLMV0RdRdH54y6sl6mioAPypt4UeUyw2qGqQCD9847yWSzu6cekBHvTl8JVoiHyIjcNf27zd_EMZ03HUZzZ0g"
                  alt="Bay Lock Latch Engaged"
                  referrerPolicy="no-referrer"
                  className="w-full h-24 object-cover"
                />
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.2 rounded font-mono">
                  Bay Lock Latch Engaged
                </span>
              </div>
            </div>
          </section>

          {/* Tech Log Notes */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-sm space-y-2">
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
              Technician Log Notes
            </label>
            <textarea
              rows={2}
              value={techNotes}
              onChange={(e) => setTechNotes(e.target.value)}
              className="w-full p-2.5 bg-surface border border-outline-variant rounded-xl text-xs text-on-surface"
            ></textarea>
          </section>

          {/* Primary Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleSignOff}
              className="w-full h-[52px] bg-primary text-on-primary rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:bg-primary-container active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">verified</span>
              <span>Sign Off & Return {order.bikeId} to Active Fleet</span>
            </button>

            <button
              onClick={() => onNavigate('maintenance')}
              className="w-full py-2 text-xs text-on-surface-variant hover:text-on-surface text-center font-semibold"
            >
              Pass to Secondary Inspection / Keep Locked
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
