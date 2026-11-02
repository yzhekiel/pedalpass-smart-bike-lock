import React, { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { CheckResult, checkIdentity } from '../lib/identityCheck';

/**
 * Identity approvals — admin and security staff compare each rider's selfie with their
 * school ID, check the COR, then approve or reject. An automatic check (face match +
 * student number, lib/identityCheck.ts) runs in this browser to help them decide.
 * Photos are deleted after review (Data Privacy Act, RA 10173).
 * See supabase/migrations/002_identity_verification.sql.
 */

type Pending = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'faculty';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, name, email, role, student_id, course, year_level, section, department, submitted_at')
      .eq('verification_status', 'pending_review')
      .order('submitted_at', { ascending: true });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Pending[];
    setPending(rows);

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

  const review = async (rider: Pending, approve: boolean, reason?: string) => {
    setBusyId(rider.id);
    setError('');
    const { error: err } = await supabase.rpc('review_verification', {
      p_user_id: rider.id,
      p_approve: approve,
      p_reason: reason ?? null,
    });
    if (err) {
      setError(err.message);
      setBusyId(null);
      return;
    }
    // Privacy: the photos are no longer needed once reviewed
    await supabase.storage.from('verification').remove(DOCS.map((d) => `${rider.id}/${d.file}`));
    setPending((prev) => prev.filter((p) => p.id !== rider.id));
    setRejecting(null);
    setBusyId(null);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 text-sm text-on-surface-variant">
        Identity approvals need the Supabase connection. Fill in <code>web/.env</code> (see <code>.env.example</code>).
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 space-y-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Identity approvals</h2>
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

      {loading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : pending.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-[36px] text-primary">task_alt</span>
          <p className="font-bold mt-2">No one is waiting for approval</p>
        </div>
      ) : (
        pending.map((rider) => (
          <article key={rider.id} className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-extrabold">{rider.name}</p>
                <p className="text-xs text-on-surface-variant">{rider.email}</p>
                <p className="text-xs mt-1">
                  <span className="font-bold uppercase text-primary">{rider.role}</span>
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

            <AutoCheck check={checks[rider.id]} studentId={rider.student_id} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DOCS.map((d) => {
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

            {rejecting?.id === rider.id ? (
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

const FACE_LABEL: Record<CheckResult['faceVerdict'], { text: string; color: string; icon: string }> = {
  strong: { text: 'Strong match', color: 'text-[#006948]', icon: 'check_circle' },
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
        <span className="material-symbols-outlined text-[16px] text-primary animate-spin">progress_activity</span>
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
        <span className="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
        Automatic check
      </span>
      <span className={`flex items-center gap-1 font-bold ${face.color}`}>
        <span className="material-symbols-outlined text-[16px]">{face.icon}</span>
        Face: {face.text}
        {faceSimilarity !== null && ` (${Math.round(faceSimilarity * 100)}%)`}
      </span>
      <span className={`flex items-center gap-1 font-bold ${idFound ? 'text-[#006948]' : 'text-tertiary'}`}>
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
