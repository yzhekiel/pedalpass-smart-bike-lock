import React, { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { CheckResult, checkIdentity } from '../lib/identityCheck';
import { Advice, adviseApproval, OtherAccount } from '../lib/approvalAdvice';

/**
 * Identity approvals — admin and security staff compare each rider's selfie with their
 * school ID, check the COR, then approve or reject. An automatic check (face match +
 * student number, lib/identityCheck.ts) runs in this browser to help them decide.
 * After review the selfie and COR are deleted; an approved rider's ID photo is kept for their account
 * (Data Privacy Act, RA 10173 — riders are told this in the sign-up consent).
 * See supabase/migrations/002_identity_verification.sql.
 */

type Pending = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  member_type: 'student' | 'faculty';
  student_id: string | null;
  course: string | null;
  year_level: string | null;
  section: string | null;
  department: string | null;
  submitted_at: string;
};

type Check = { state: 'checking' } | { state: 'done'; result: CheckResult } | { state: 'failed'; message: string };

const DOCS = [
  { file: 'selfie.jpg', label: 'Selfie' },
  { file: 'id.jpg', label: 'School ID' },
  { file: 'cor.jpg', label: 'COR' },
] as const;

type Photos = Record<string, string | undefined>; // file name → signed URL

export const VerificationsScreen: React.FC = () => {
  const [pending, setPending] = useState<Pending[]>([]);
  const [photos, setPhotos] = useState<Record<string, Photos>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [twins, setTwins] = useState<Record<string, OtherAccount[]>>({}); // rider id → other accounts with the same Student No.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [show, setShow] = useState<'all' | Advice['verdict']>('all');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkProgress, setBulkProgress] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, name, email, role, member_type, student_id, course, year_level, section, department, submitted_at')
      .eq('verification_status', 'pending_review')
      .order('submitted_at', { ascending: true });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Pending[];
    setPending(rows);
    setSelected(new Set());

    // Duplicate check: any other account (pending, approved or rejected) with the same Student No.
    const numbers = [...new Set(rows.map((r) => r.student_id).filter((n): n is string => !!n))];
    const found: Record<string, OtherAccount[]> = {};
    if (numbers.length) {
      const { data: others } = await supabase
        .from('profiles')
        .select('id, name, email, verification_status, student_id')
        .in('student_id', numbers);
      for (const r of rows) found[r.id] = (others ?? []).filter((o) => o.student_id === r.student_id && o.id !== r.id);
    }
    setTwins(found);

    // Short-lived links to the private photos (valid 10 minutes)
    const paths = rows.flatMap((r) => DOCS.map((d) => `${r.id}/${d.file}`));
    const urls: Record<string, Photos> = {};
    if (paths.length) {
      const { data: signed } = await supabase.storage.from('verification').createSignedUrls(paths, 600);
      for (const s of signed ?? []) {
        if (!s.path) continue;
        const [userId, file] = s.path.split('/');
        (urls[userId] ??= {})[file] = s.signedUrl ?? undefined;
      }
    }
    setPhotos(urls);
    setLoading(false);

    // Run the automatic check one rider at a time (face models are heavy for the browser)
    for (const r of rows) {
      const p = urls[r.id];
      if (!p?.['id.jpg'] || !p['selfie.jpg']) continue;
      setChecks((prev) => ({ ...prev, [r.id]: { state: 'checking' } }));
      try {
        const result = await checkIdentity({ id: p['id.jpg'], selfie: p['selfie.jpg'], cor: p['cor.jpg'] }, r.student_id);
        setChecks((prev) => ({ ...prev, [r.id]: { state: 'done', result } }));
      } catch (e) {
        setChecks((prev) => ({ ...prev, [r.id]: { state: 'failed', message: (e as Error).message } }));
      }
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) load();
  }, [load]);

  /** Returns false (and shows the error) if the review was not saved. */
  const review = async (rider: Pending, approve: boolean, reason?: string): Promise<boolean> => {
    setBusyId(rider.id);
    setError('');
    const { error: err } = await supabase.rpc('review_verification', {
      p_user_id: rider.id,
      p_approve: approve,
      p_reason: reason ?? null,
    });
    if (err) {
      setError(`${rider.name}: ${err.message}`);
      setBusyId(null);
      return false;
    }
    // Privacy: the selfie and COR are not needed once reviewed. An approved rider's ID photo is kept so
    // admins can identify who rode a bike (Bike History → View rider); a rejected rider uploads new ones.
    const remove = approve ? DOCS.filter((d) => d.file !== 'id.jpg') : DOCS;
    await supabase.storage.from('verification').remove(remove.map((d) => `${rider.id}/${d.file}`));
    setPending((prev) => prev.filter((p) => p.id !== rider.id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(rider.id);
      return next;
    });
    setRejecting(null);
    setBusyId(null);
    return true;
  };

  const adviceFor = (r: Pending) => {
    const c = checks[r.id];
    return adviseApproval(r, c?.state === 'done' ? c.result : null, twins[r.id] ?? []);
  };

  /** Approve or reject every ticked rider, one after another. Stops at the first error. */
  const reviewSelected = async (approve: boolean) => {
    const riders = pending.filter((p) => selected.has(p.id));
    const verb = approve ? 'Approve' : 'Reject';
    if (!riders.length || !confirm(`${verb} ${riders.length} ${riders.length === 1 ? 'account' : 'accounts'}?`)) return;
    for (const [i, r] of riders.entries()) {
      setBulkProgress(`${verb.replace(/e$/, '')}ing ${i + 1} of ${riders.length}…`);
      if (!(await review(r, approve, approve ? undefined : bulkReason.trim()))) break;
    }
    setBulkProgress('');
    setBulkReason('');
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 text-sm text-on-surface-variant">
        Identity approvals need the Supabase connection. Fill in <code>web/.env</code> (see <code>.env.example</code>).
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-on-surface-variant">
            Compare the selfie with the school ID photo, and check the COR is for the current semester.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant font-bold text-xs hover:bg-surface-container disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-xs font-bold text-error flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </p>
      )}

      {!loading && pending.length > 0 && (
        <BulkBar
          counts={pending.reduce((c, r) => ({ ...c, [adviceFor(r).verdict]: (c[adviceFor(r).verdict] ?? 0) + 1 }), {} as Record<string, number>)}
          total={pending.length}
          show={show}
          onShow={setShow}
          selected={selected.size}
          checksRunning={pending.some((r) => checks[r.id]?.state === 'checking')}
          onSelectRecommended={() => setSelected(new Set(pending.filter((r) => adviceFor(r).verdict === 'approve').map((r) => r.id)))}
          onClear={() => setSelected(new Set())}
          reason={bulkReason}
          onReason={setBulkReason}
          progress={bulkProgress}
          onApprove={() => reviewSelected(true)}
          onReject={() => reviewSelected(false)}
        />
      )}

      {loading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : pending.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-[36px] text-primary-light">task_alt</span>
          <p className="font-bold mt-2">No one is waiting for approval</p>
        </div>
      ) : (
        pending
          .filter((r) => show === 'all' || adviceFor(r).verdict === show)
          .map((rider) => (
          <article
            key={rider.id}
            className={`bg-surface-container-lowest border rounded-xl p-4 shadow-sm space-y-3 ${selected.has(rider.id) ? 'border-primary-light ring-1 ring-primary-light' : 'border-outline-variant/60'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <input
                type="checkbox"
                checked={selected.has(rider.id)}
                onChange={() => toggle(rider.id)}
                className="w-4 h-4 mt-1 rounded text-primary-light"
                aria-label={`Select ${rider.name}`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-extrabold">{rider.name}</p>
                <p className="text-xs text-on-surface-variant">{rider.email}</p>
                <p className="text-xs mt-1">
                  <span className="font-bold uppercase text-primary-light">{rider.member_type}</span>
                  {rider.student_id && <> • ID {rider.student_id}</>}
                  {rider.course && <> • {rider.course}</>}
                  {rider.year_level && <> • {rider.year_level}</>}
                  {rider.section && <> • {rider.section}</>}
                  {rider.department && <> • {rider.department}</>}
                </p>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Submitted {new Date(rider.submitted_at).toLocaleString()}
              </p>
            </div>

            <AdviceBox advice={adviceFor(rider)} pending={checks[rider.id]?.state === 'checking'} />

            {rider.member_type === 'faculty' ? (
              <p className="text-xs bg-surface-container rounded-lg px-3 py-2">
                <span className="font-bold">Faculty / staff:</span> ID photo only — check the photo, name and ID number before approving.
              </p>
            ) : (
              <AutoCheck check={checks[rider.id]} studentId={rider.student_id} />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(rider.member_type === 'faculty' ? DOCS.filter((d) => d.file === 'id.jpg') : DOCS).map((d) => {
                const url = photos[rider.id]?.[d.file];
                return (
                  <figure key={d.file} className="space-y-1">
                    <figcaption className="text-[11px] font-bold text-on-surface-variant">{d.label}</figcaption>
                    {url ? (
                      <button onClick={() => setZoom(url)} className="block w-full" aria-label={`Enlarge ${d.label}`}>
                        <img src={url} alt={d.label} className="w-full h-48 object-cover rounded-lg border border-outline-variant/60 bg-surface-container" />
                      </button>
                    ) : (
                      <div className="w-full h-48 rounded-lg bg-surface-container flex items-center justify-center text-xs text-on-surface-variant">
                        Missing
                      </div>
                    )}
                  </figure>
                );
              })}
            </div>

            {rejecting && rejecting.id === rider.id ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  autoFocus
                  value={rejecting.reason}
                  onChange={(e) => setRejecting({ id: rider.id, reason: e.target.value })}
                  placeholder="Reason, e.g. ID photo is blurry"
                  className="flex-1 h-10 px-3 rounded-lg border border-outline-variant bg-surface text-sm"
                />
                <button
                  disabled={busyId === rider.id || !rejecting.reason.trim()}
                  onClick={() => review(rider, false, rejecting.reason)}
                  className="h-10 px-4 rounded-lg bg-error text-white font-bold text-xs disabled:opacity-60"
                >
                  Confirm reject
                </button>
                <button onClick={() => setRejecting(null)} className="h-10 px-4 rounded-lg font-bold text-xs hover:bg-surface-container">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  disabled={busyId === rider.id}
                  onClick={() => review(rider, true)}
                  className="flex-1 sm:flex-none h-10 px-5 rounded-lg bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  Approve
                </button>
                <button
                  disabled={busyId === rider.id}
                  onClick={() => setRejecting({ id: rider.id, reason: '' })}
                  className="flex-1 sm:flex-none h-10 px-5 rounded-lg border border-error text-error font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">block</span>
                  Reject
                </button>
              </div>
            )}
          </article>
        ))
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Enlarged document" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
};

const ADVICE_STYLE: Record<Advice['verdict'], { label: string; tone: string; icon: string }> = {
  approve: { label: 'Recommended: approve', tone: 'bg-success-container text-on-success-container', icon: 'thumb_up' },
  review: { label: 'Look closely', tone: 'bg-tertiary-container text-on-tertiary-container', icon: 'visibility' },
  reject: { label: 'Recommended: reject', tone: 'bg-error-container text-on-error-container', icon: 'thumb_down' },
};

function AdviceBox({ advice, pending }: { advice: Advice; pending: boolean }) {
  const s = ADVICE_STYLE[advice.verdict];
  return (
    <div className={`rounded-lg px-3 py-2 text-xs ${s.tone}`}>
      <p className="font-extrabold flex items-center gap-1">
        <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
        {pending ? 'Checking…' : s.label}
      </p>
      <ul className="list-disc ml-5 mt-0.5 space-y-0.5">
        {advice.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

function BulkBar(p: {
  counts: Record<string, number>;
  total: number;
  show: 'all' | Advice['verdict'];
  onShow: (v: 'all' | Advice['verdict']) => void;
  selected: number;
  checksRunning: boolean;
  onSelectRecommended: () => void;
  onClear: () => void;
  reason: string;
  onReason: (v: string) => void;
  progress: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const busy = !!p.progress;
  return (
    <section className="sticky top-16 z-20 bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3 shadow-sm space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {([
          ['all', `All ${p.total}`],
          ['approve', `Approve ${p.counts.approve ?? 0}`],
          ['review', `Look closely ${p.counts.review ?? 0}`],
          ['reject', `Reject ${p.counts.reject ?? 0}`],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => p.onShow(v)}
            className={`px-3 py-1.5 rounded-full font-bold border ${p.show === v ? 'bg-primary text-on-primary border-primary-light' : 'border-outline-variant'}`}
          >
            {label}
          </button>
        ))}
        {p.checksRunning && <span className="text-on-surface-variant">Automatic checks still running…</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={p.onSelectRecommended} disabled={busy} className="px-3 py-2 rounded-lg border border-outline-variant text-xs font-bold hover:bg-surface-container">
          Select all recommended ({p.counts.approve ?? 0})
        </button>
        {p.selected > 0 && (
          <button onClick={p.onClear} disabled={busy} className="px-3 py-2 rounded-lg text-xs font-bold hover:bg-surface-container">
            Clear ({p.selected})
          </button>
        )}
        <span className="flex-1" />
        <button
          onClick={p.onApprove}
          disabled={!p.selected || busy}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-50 flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">verified</span>
          Approve selected ({p.selected})
        </button>
        <input
          value={p.reason}
          onChange={(e) => p.onReason(e.target.value)}
          placeholder="Reason for rejecting"
          className="w-44 px-3 py-2 rounded-lg border border-outline-variant bg-surface text-xs"
        />
        <button
          onClick={p.onReject}
          disabled={!p.selected || busy || !p.reason.trim()}
          className="px-4 py-2 rounded-lg border border-error text-error text-xs font-bold disabled:opacity-50"
        >
          Reject selected
        </button>
      </div>
      {p.progress && <p className="text-xs font-bold text-primary-light">{p.progress}</p>}
      <p className="text-[10px] text-on-surface-variant">
        Recommendations come from the face match, the Student No. on the documents and duplicate accounts. You make the final decision.
      </p>
    </section>
  );
}

const FACE_LABEL: Record<CheckResult['faceVerdict'], { text: string; color: string; icon: string }> = {
  strong: { text: 'Strong match', color: 'text-success', icon: 'check_circle' },
  possible: { text: 'Possible match — look closely', color: 'text-tertiary', icon: 'help' },
  no_match: { text: 'Faces look different', color: 'text-error', icon: 'cancel' },
  no_face: { text: 'No face found in ID or selfie', color: 'text-error', icon: 'cancel' },
};

/** Result of the in-browser check. It only advises — staff make the decision. */
function AutoCheck({ check, studentId }: { check?: Check; studentId: string | null }) {
  if (!check) return null;
  const box = 'text-xs bg-surface-container rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1';
  if (check.state === 'checking') {
    return (
      <p className={box}>
        <span className="material-symbols-outlined text-[16px] text-primary-light animate-spin">progress_activity</span>
        Automatic check running… (the first one loads the AI models and takes longer)
      </p>
    );
  }
  if (check.state === 'failed') {
    return <p className={`${box} text-on-surface-variant`}>Automatic check unavailable ({check.message}) — compare the photos yourself.</p>;
  }
  const { faceSimilarity, faceVerdict, idNumberOnId, idNumberOnCor } = check.result;
  const face = FACE_LABEL[faceVerdict];
  const idFound = idNumberOnId || idNumberOnCor;
  return (
    <div className={box}>
      <span className="font-bold flex items-center gap-1">
        <span className="material-symbols-outlined text-[16px] text-primary-light">smart_toy</span>
        Automatic check
      </span>
      <span className={`flex items-center gap-1 font-bold ${face.color}`}>
        <span className="material-symbols-outlined text-[16px]">{face.icon}</span>
        Face: {face.text}
        {faceSimilarity !== null && ` (${Math.round(faceSimilarity * 100)}%)`}
      </span>
      <span className={`flex items-center gap-1 font-bold ${idFound ? 'text-success' : 'text-tertiary'}`}>
        <span className="material-symbols-outlined text-[16px]">{idFound ? 'check_circle' : 'help'}</span>
        Student No. {studentId ?? '—'}:{' '}
        {idNumberOnId && idNumberOnCor
          ? 'found on ID and COR'
          : idNumberOnId
            ? 'found on ID'
            : idNumberOnCor
              ? 'found on COR'
              : 'not read automatically — check the photo'}
      </span>
    </div>
  );
}
