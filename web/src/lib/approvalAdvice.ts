/**
 * Recommendation for an identity approval, from fixed rules over real data (no paid AI):
 * the in-browser face match + student-number reading (identityCheck.ts), the student-number format,
 * and duplicate accounts. It only advises — an admin still approves or rejects.
 */
import { CheckResult } from './identityCheck';

export type Advice = { verdict: 'approve' | 'review' | 'reject'; reasons: string[] };

export type OtherAccount = { id: string; name: string; email: string; verification_status: string };

type Rider = { member_type: 'student' | 'faculty'; student_id: string | null; course: string | null };

/** DYCI student numbers look like 2024-09536 */
const STUDENT_NO = /^\d{4}-\d{5}$/;

export function adviseApproval(rider: Rider, check: CheckResult | null | undefined, sameStudentNo: OtherAccount[]): Advice {
  const reasons: string[] = [];
  let verdict: Advice['verdict'] = 'approve';
  const worst = (v: Advice['verdict']) => {
    if (v === 'reject' || (v === 'review' && verdict === 'approve')) verdict = v;
  };

  const approvedTwin = sameStudentNo.find((a) => a.verification_status === 'approved');
  if (approvedTwin) {
    worst('reject');
    reasons.push(`Student No. already used by approved account ${approvedTwin.name} (${approvedTwin.email})`);
  } else if (sameStudentNo.length) {
    worst('review');
    reasons.push(`Same Student No. as ${sameStudentNo.map((a) => a.name).join(', ')} — possible duplicate sign-up`);
  }

  if (rider.member_type === 'faculty') {
    worst('review');
    reasons.push('Faculty/staff: no face match — check the ID photo and name');
    return { verdict, reasons };
  }

  if (!rider.student_id || !STUDENT_NO.test(rider.student_id)) {
    worst('review');
    reasons.push(`Student No. "${rider.student_id ?? ''}" is not in the 2024-09536 format`);
  }
  if (!rider.course) {
    worst('review');
    reasons.push('No course given');
  }

  if (!check) {
    worst('review');
    reasons.push('Automatic check has not run');
  } else {
    if (check.faceVerdict === 'strong') reasons.push(`Face matches the ID (${Math.round((check.faceSimilarity ?? 0) * 100)}%)`);
    else if (check.faceVerdict === 'possible') {
      worst('review');
      reasons.push('Face only possibly matches — compare the photos');
    } else {
      worst('reject');
      reasons.push(check.faceVerdict === 'no_face' ? 'No face found in the ID or selfie' : 'Selfie does not match the ID photo');
    }
    if (check.idNumberOnId || check.idNumberOnCor) reasons.push('Student No. found on the documents');
    else {
      worst('review');
      reasons.push('Student No. not found on the ID or COR');
    }
  }
  return { verdict, reasons };
}
