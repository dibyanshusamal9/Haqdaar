import { Profile, ProfileField } from '../domain/profile';
import { Predicate } from '../domain/rules';

/**
 * Deterministic ranking (UC-04 step 6). A scheme that was written for someone like the
 * citizen (passes many specific conditions) outranks one that is open to everybody.
 * Every input is fixed data, so equal inputs always produce the same order.
 */

// How much a satisfied condition says "this scheme is meant for you".
export const FIELD_WEIGHT: Record<ProfileField, number> = {
  occupation: 4, disability: 4, student: 3, bpl: 3, minority: 3, economic_distress: 3, gov_employee: 3,
  marital_status: 3, caste: 3, gender: 2, state: 2, annual_income: 2, employment_status: 2,
  residence: 1, age: 1, disability_percent: 1,
};

/** Scheme categories that fit the profile, with a small boost each. */
export function categoryAffinity(p: Profile): Map<string, number> {
  const a = new Map<string, number>();
  const add = (c: string, w: number) => a.set(c, Math.max(a.get(c) ?? 0, w));
  if (p.student) add('Education & Learning', 2);
  if (p.occupation && ['farmer', 'dairy_farmer', 'fisherman'].includes(p.occupation)) add('Agriculture,Rural & Environment', 2);
  if (p.occupation && ['artisan_weaver', 'khadi_artisan', 'coir_worker', 'street_vendor'].includes(p.occupation)) add('Business & Entrepreneurship', 1);
  if (p.occupation && ['artist', 'sportsperson'].includes(p.occupation)) add('Sports & Culture', 2);
  if (p.employment_status === 'unemployed') add('Skills & Employment', 2);
  if (p.employment_status === 'self_employed') add('Business & Entrepreneurship', 1);
  if (p.gender === 'female') add('Women and Child', 1);
  if (p.disability || p.age >= 60 || p.bpl || p.marital_status === 'widowed') add('Social welfare & Empowerment', 1);
  if (p.residence === 'rural') add('Agriculture,Rural & Environment', 1);
  return a;
}

export interface Candidate {
  slug: string;
  name: string;
  status: 'eligible' | 'likely';
  passed: Predicate[];
  verify: Predicate[];
  categories: string[];
  closeDate: string | null;
}

export function score(c: Candidate, affinity: Map<string, number>): number {
  const specific = c.passed.reduce((s, p) => s + (FIELD_WEIGHT[p.field] ?? 1), 0);
  const fit = Math.max(0, ...c.categories.map((cat) => affinity.get(cat) ?? 0));
  return specific + fit - 0.5 * c.verify.length;
}

export function isClosed(closeDate: string | null, today: string): boolean {
  return !!closeDate && closeDate < today;
}

/** Open before closed, then score, then fully eligible first, then name and slug. */
export function rank<T extends Candidate>(cands: T[], profile: Profile, today: string): (T & { score: number; closed: boolean })[] {
  const affinity = categoryAffinity(profile);
  return cands
    .map((c) => ({ ...c, score: Math.round(score(c, affinity) * 10) / 10, closed: isClosed(c.closeDate, today) }))
    .sort(
      (a, b) =>
        Number(a.closed) - Number(b.closed) ||
        b.score - a.score ||
        (a.status === b.status ? 0 : a.status === 'eligible' ? -1 : 1) ||
        cmp(a.name, b.name) ||
        cmp(a.slug, b.slug),
    );
}

// Code-point order, not localeCompare: the order must not depend on the server's locale.
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
