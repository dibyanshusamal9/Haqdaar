import { LABELS, Profile, ProfileField } from './profile';

/**
 * Eligibility rules are data (report §1.1 "Rules as data"): each scheme stores a JSONB
 * RuleSet next to its record, and the SQL function haqdaar_eval() decides each predicate.
 *
 *   in       profile value (or any of its expanded values) is one of `value`
 *   eq       profile value equals `value` (booleans)
 *   gte/lte  numeric comparison
 *   between  value = [lo, hi] inclusive
 *
 * `strict` narrows a numeric bound we only know approximately: inside `strict` is a pass,
 * inside `value` but outside `strict` is "verify" (unknown), outside `value` is a fail.
 * `strength: soft` marks predicates parsed from free text that myscheme does not tag:
 * they never exclude a scheme on their own, they only ask the citizen to verify.
 */
export type Op = 'in' | 'eq' | 'gte' | 'lte' | 'between';
export type PredicateSource = 'myscheme-facet' | 'eligibility-text' | 'curator';

export interface Predicate {
  id: string;
  field: ProfileField;
  op: Op;
  value: string[] | boolean | number | [number, number];
  strict?: number | [number, number];
  strength?: 'hard' | 'soft';
  src: PredicateSource;
  label: string;
}

export interface RuleSet {
  version: 1;
  all: Predicate[];
}

export const EMPTY_RULES: RuleSet = { version: 1, all: [] };

export function rupees(n: number): string {
  // Indian digit grouping: 2,50,000
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function list(field: keyof typeof LABELS, values: string[]): string {
  const labels = LABELS[field] as Record<string, string>;
  const names = values.map((v) => labels[v] ?? v);
  return names.length <= 2 ? names.join(' or ') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** The condition as the scheme states it ("Women", "Age 18–40"). */
export function predicateLabel(p: Omit<Predicate, 'label'>): string {
  const v = p.value;
  switch (p.field) {
    case 'state':
      return `Residents of ${(v as string[]).join(', ')}`;
    case 'gender': {
      const plural: Record<string, string> = { female: 'women', male: 'men', transgender: 'transgender persons' };
      const names = (v as string[]).map((g) => plural[g] ?? g);
      return `For ${names.join(' or ')}`;
    }
    case 'caste':
      return `${list('caste', v as string[])} applicants`;
    case 'residence':
      return `${list('residence', v as string[])} residents`;
    case 'marital_status':
      return `Marital status: ${list('marital_status', v as string[])}`;
    case 'employment_status':
      return `${list('employment_status', v as string[])} applicants`;
    case 'occupation':
      return `Occupation: ${list('occupation', v as string[])}`;
    case 'age': {
      if (p.op === 'between') {
        // With an uncertain band, describe the range we are sure of.
        const [lo, hi] = (Array.isArray(p.strict) ? p.strict : v) as [number, number];
        const note = p.strict !== undefined ? ' (exact limit unclear)' : '';
        if (hi >= 120 && lo <= 0) return `Any age${note}`;
        if (hi >= 120) return `Age ${lo} or above${note}`;
        if (lo <= 0) return `Age up to ${hi}${note}`;
        return `Age ${lo}–${hi}${note}`;
      }
      return p.op === 'gte' ? `Age ${v} or above` : `Age up to ${v}`;
    }
    case 'annual_income':
      return typeof p.strict === 'number'
        ? `Annual family income up to ${rupees(p.strict)} (up to ${rupees(v as number)} for some applicants)`
        : `Annual family income up to ${rupees(v as number)}`;
    case 'disability_percent':
      return typeof p.strict === 'number' ? `Disability of ${v}–${p.strict}% or more` : `Disability of ${v}% or more`;
    case 'disability':
      return 'Persons with disabilities';
    case 'minority':
      return 'Minority communities';
    case 'bpl':
      return 'Below Poverty Line (BPL) households';
    case 'student':
      return 'Students';
    case 'gov_employee':
      return 'Government employees';
    case 'economic_distress':
      return 'Families in economic distress';
    default:
      return `${p.field} ${p.op} ${JSON.stringify(v)}`;
  }
}

/** Why the citizen satisfies a predicate, phrased from their own profile values. */
export function reasonFor(p: Predicate, profile: Profile): string {
  switch (p.field) {
    case 'state':
      return `You live in ${profile.state}`;
    case 'gender':
      return `You are ${profile.gender === 'female' ? 'a woman' : profile.gender === 'male' ? 'a man' : 'a transgender person'}`;
    case 'caste':
      return `You belong to the ${LABELS.caste[profile.caste]} category`;
    case 'residence':
      return `You live in a ${profile.residence} area`;
    case 'age':
      return `You are ${profile.age}; the scheme covers ${p.label.replace(/^Age /, 'ages ').toLowerCase()}`;
    case 'annual_income':
      return profile.annual_income === null
        ? p.label
        : `Your family income ${rupees(profile.annual_income)} is within the ${rupees(p.value as number)} limit`;
    case 'marital_status':
      return profile.marital_status ? `You are ${LABELS.marital_status[profile.marital_status].toLowerCase()}` : p.label;
    case 'occupation':
      if (!profile.occupation || profile.occupation === 'other') return profile.student ? 'You are a student' : p.label;
      return `You work as: ${LABELS.occupation[profile.occupation].toLowerCase()}`;
    case 'employment_status':
      return profile.employment_status ? `You are ${LABELS.employment_status[profile.employment_status].toLowerCase()}` : p.label;
    case 'disability':
      return 'You have a disability';
    case 'disability_percent':
      return `Your disability (${profile.disability_percent ?? '?'}%) meets the ${p.value}% threshold`;
    case 'minority':
      return 'You belong to a minority community';
    case 'bpl':
      return 'Your household is below the poverty line';
    case 'student':
      return 'You are a student';
    case 'gov_employee':
      return 'You are a government employee';
    case 'economic_distress':
      return 'Your family is in economic distress';
    default:
      return p.label;
  }
}

/** What the citizen should double-check for a predicate the matcher could not decide. */
export function verifyFor(p: Predicate, profile: Profile): string {
  const value = profile[p.field];
  if (value === null || value === undefined) {
    return `${p.label} — add your ${fieldName(p.field)} to confirm`;
  }
  if (p.strength === 'soft') {
    return p.src === 'eligibility-text' ? `${p.label} (from the scheme text — please confirm)` : `${p.label} — please confirm this applies to you`;
  }
  return `${p.label} — your value is close to the limit; check the official rules`;
}

export function fieldName(f: ProfileField): string {
  const names: Partial<Record<ProfileField, string>> = {
    annual_income: 'annual family income',
    marital_status: 'marital status',
    employment_status: 'employment status',
    disability_percent: 'disability percentage',
    gov_employee: 'government-employee status',
    economic_distress: 'economic-distress status',
  };
  return names[f] ?? f.replace(/_/g, ' ');
}
