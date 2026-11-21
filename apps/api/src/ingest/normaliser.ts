import { FACET_VALUE_MAP, GENDERS, CASTES, RESIDENCES, MARITAL_STATUSES, EMPLOYMENT_STATUSES, ProfileField, STATES } from '../domain/profile';
import { Predicate, predicateLabel, RuleSet } from '../domain/rules';
import { cleanMarkdown, parseAge, parseIncome } from './eligibility-text';
import { SearchHit } from './myscheme.client';
import { ResolvedRange } from './range-probe';

/**
 * Raw myscheme data -> one scheme record with JSONB rules (UC-06 step 4).
 *
 * Rule sources, strongest first:
 *  1. myscheme facets (structured tags the portal itself filters on) -> hard predicates
 *  2. myscheme range filters (age, disability %) recovered by probing -> hard, possibly
 *     with an uncertain band that resolves to "verify" instead of pass/fail
 *  3. the eligibility text, parsed by regex -> income ceilings (hard when unambiguous),
 *     and age bounds where myscheme has none (soft: never excludes on its own)
 * Anything we could not normalise lands in reviewReasons and the scheme is flagged.
 */

export interface FacetIndex {
  /** facet identifier -> myscheme value label -> slugs tagged with it */
  [identifier: string]: Record<string, Set<string>>;
}

export interface NormaliserInput {
  hit: SearchHit;
  detail: any | null;
  documents: any | null;
  facets: FacetIndex;
  age: ResolvedRange | undefined;
  disability: ResolvedRange | undefined;
}

export interface SchemeRecord {
  sourceUrl: string;
  slug: string;
  myschemeId: string | null;
  name: string;
  shortTitle: string | null;
  level: 'central' | 'state';
  schemeType: string | null;
  schemeFor: string | null;
  states: string[];
  ministry: string | null;
  department: string | null;
  implementingAgency: string | null;
  categories: string[];
  subCategories: string[];
  tags: string[];
  brief: string | null;
  descriptionMd: string | null;
  benefitsMd: string | null;
  exclusionsMd: string | null;
  eligibilityMd: string | null;
  documentsMd: string | null;
  applicationMd: string | null;
  applicationModes: string[];
  applyUrl: string | null;
  references: { title: string; url: string }[];
  benefitType: string | null;
  isDbt: boolean | null;
  openDate: string | null;
  closeDate: string | null;
  rules: RuleSet;
  reviewReasons: string[];
}

export const SITE = 'https://www.myscheme.gov.in';

const CATEGORICAL: { facet: string; field: ProfileField; universe: readonly string[] }[] = [
  { facet: 'gender', field: 'gender', universe: GENDERS },
  { facet: 'caste', field: 'caste', universe: CASTES },
  { facet: 'residence', field: 'residence', universe: RESIDENCES },
  { facet: 'maritalStatus', field: 'marital_status', universe: MARITAL_STATUSES },
  { facet: 'employmentStatus', field: 'employment_status', universe: EMPLOYMENT_STATUSES },
  { facet: 'occupation', field: 'occupation', universe: [] },
];

const BOOLEAN: { facet: string; field: ProfileField }[] = [
  { facet: 'disability', field: 'disability' },
  { facet: 'minority', field: 'minority' },
  { facet: 'isBpl', field: 'bpl' },
  { facet: 'isStudent', field: 'student' },
  { facet: 'isGovEmployee', field: 'gov_employee' },
  { facet: 'isEconomicDistress', field: 'economic_distress' },
];

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
};
const md = (v: unknown): string | null => {
  const s = str(v);
  return s && cleanMarkdown(s) ? s : null;
};
const labelOf = (v: any): string | null => str(v?.label) ?? str(v);
const labels = (arr: any): string[] =>
  Array.isArray(arr) ? arr.map(labelOf).filter((x): x is string => !!x) : [];
const date = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

function pred(p: Omit<Predicate, 'label'>): Predicate {
  return { ...p, label: predicateLabel(p) };
}

export function normaliseScheme(input: NormaliserInput): SchemeRecord {
  const { hit, detail, documents, facets } = input;
  const f = hit.fields;
  const slug = f.slug;
  const en = detail?.en ?? {};
  const basic = en.basicDetails ?? {};
  const content = en.schemeContent ?? {};
  const review: string[] = [];
  const all: Predicate[] = [];

  if (!detail) review.push('myscheme.gov.in returned no scheme page; only the listing card is stored.');

  // --- Where: state ----------------------------------------------------------------
  const rawStates = (f.beneficiaryState ?? []).map((s) => s.trim()).filter(Boolean);
  const states = rawStates.includes('All') ? [] : rawStates;
  const unknownStates = states.filter((s) => !(STATES as readonly string[]).includes(s));
  if (unknownStates.length) review.push(`Unrecognised state name(s): ${unknownStates.join(', ')}`);
  if (states.length) all.push(pred({ id: 'state', field: 'state', op: 'in', value: states, src: 'myscheme-facet' }));

  // --- Who: categorical facets ---------------------------------------------------------
  for (const c of CATEGORICAL) {
    const byValue = facets[c.facet] ?? {};
    const tagged = Object.entries(byValue).filter(([, set]) => set.has(slug)).map(([label]) => label);
    if (!tagged.length) continue;
    const mapped = tagged.map((l) => FACET_VALUE_MAP[c.facet]?.[l]).filter((v): v is string => !!v);
    const unmapped = tagged.filter((l) => !FACET_VALUE_MAP[c.facet]?.[l]);
    if (unmapped.length) review.push(`Unmapped ${c.facet} value(s): ${unmapped.join(', ')}`);
    const values = [...new Set(mapped)].sort();
    // Tagged with every possible value is the same as no restriction.
    if (!values.length || (c.universe.length && c.universe.every((u) => values.includes(u)))) continue;
    const p: Omit<Predicate, 'label'> = { id: c.field, field: c.field, op: 'in', value: values, src: 'myscheme-facet' };
    // myscheme's employment tags are loose (PM-KISAN is tagged "Employed", yet most farmers
    // call themselves self-employed), so they ask the citizen to confirm instead of excluding.
    if (c.field === 'employment_status') p.strength = 'soft';
    all.push(pred(p));
  }
  for (const b of BOOLEAN) {
    if (facets[b.facet]?.Yes?.has(slug)) {
      all.push(pred({ id: b.field, field: b.field, op: 'eq', value: true, src: 'myscheme-facet' }));
    }
  }

  // --- Age ---------------------------------------------------------------------------
  const eligibilityText = [str(en.eligibilityCriteria?.eligibilityDescription_md), str(content.exclusions_md)]
    .filter(Boolean)
    .join('\n');
  const textAge = parseAge(str(en.eligibilityCriteria?.eligibilityDescription_md) ?? '');
  const age = input.age;
  if (age && (age.lower || age.upper)) {
    let lo = age.lower?.value ?? 0;
    let hi = age.upper?.value ?? 120;
    let strictLo = age.lower ? age.lower.range[1] : 0;
    let strictHi = age.upper ? age.upper.range[0] : 120;
    // Text can pin an approximate bound when it falls inside the band myscheme allows.
    if (age.lower && !age.lower.exact && textAge.lower !== null) {
      if (textAge.lower >= age.lower.range[0] && textAge.lower <= age.lower.range[1]) lo = strictLo = textAge.lower;
    }
    if (age.upper && !age.upper.exact && textAge.upper !== null) {
      if (textAge.upper >= age.upper.range[0] && textAge.upper <= age.upper.range[1]) hi = strictHi = textAge.upper;
    }
    const p: Omit<Predicate, 'label'> = { id: 'age', field: 'age', op: 'between', value: [lo, hi], src: 'myscheme-facet' };
    if (strictLo !== lo || strictHi !== hi) p.strict = [strictLo, strictHi];
    all.push(pred(p));
  } else if (textAge.lower !== null || textAge.upper !== null) {
    const lo = textAge.lower ?? 0;
    const hi = textAge.upper ?? 120;
    if (lo < hi) {
      all.push(pred({ id: 'age', field: 'age', op: 'between', value: [lo, hi], strength: 'soft', src: 'eligibility-text' }));
    }
  }
  if (textAge.ambiguous && !(age && (age.lower || age.upper))) {
    review.push('Eligibility text states several different age limits.');
  }

  // --- Disability percentage -----------------------------------------------------------
  const dis = input.disability?.lower;
  if (dis && dis.value > 0) {
    const p: Omit<Predicate, 'label'> = { id: 'disability_percent', field: 'disability_percent', op: 'gte', value: dis.value, src: 'myscheme-facet' };
    if (!dis.exact) p.strict = dis.range[1];
    all.push(pred(p));
  }

  // --- Income (text only: myscheme exposes no income facet) ------------------------------
  const income = parseIncome(eligibilityText);
  if (income.ceilings.length) {
    const max = income.ceilings[income.ceilings.length - 1];
    const min = income.ceilings[0];
    const p: Omit<Predicate, 'label'> = { id: 'annual_income', field: 'annual_income', op: 'lte', value: max, src: 'eligibility-text' };
    if (min !== max) {
      p.strict = min;
      review.push(`Several income limits in the text (${income.ceilings.join(', ')}); the highest is used, lower ones ask the citizen to verify.`);
    }
    all.push(pred(p));
  } else if (income.unparsed) {
    review.push('Eligibility text mentions an income condition that could not be normalised.');
  }

  if (detail && !md(en.eligibilityCriteria?.eligibilityDescription_md)) review.push('No eligibility text on the scheme page.');

  // --- Presentation fields -------------------------------------------------------------------
  const process = Array.isArray(en.applicationProcess) ? en.applicationProcess : [];
  const modes = [...new Set(process.map((p: any) => str(p?.mode)).filter(Boolean) as string[])];
  const applyUrl = process.map((p: any) => str(p?.url)).find((u: string | null) => !!u && /^https?:\/\//i.test(u)) ?? null;
  const applicationMd = process
    .filter((p: any) => md(p?.process_md))
    .map((p: any) => (process.length > 1 && str(p?.mode) ? `#### ${str(p.mode)}\n\n${str(p.process_md)}` : str(p.process_md)))
    .join('\n\n') || null;
  const levelRaw = (str(basic.level?.value) ?? str(f.level) ?? '').toLowerCase();

  return {
    sourceUrl: `${SITE}/schemes/${slug}`,
    slug,
    myschemeId: str(detail?._id),
    name: str(basic.schemeName) ?? str(f.schemeName) ?? slug,
    shortTitle: str(basic.schemeShortTitle) ?? str(f.schemeShortTitle),
    level: levelRaw === 'central' ? 'central' : 'state',
    schemeType: labelOf(basic.schemeType),
    schemeFor: str(basic.schemeFor) ?? str(f.schemeFor),
    states,
    ministry: labelOf(basic.nodalMinistryName) ?? str(f.nodalMinistryName),
    department: labelOf(basic.nodalDepartmentName),
    implementingAgency: str(basic.implementingAgency),
    categories: labels(basic.schemeCategory).length ? labels(basic.schemeCategory) : (f.schemeCategory ?? []),
    subCategories: labels(basic.schemeSubCategory),
    tags: (Array.isArray(basic.tags) ? basic.tags : f.tags ?? []).map((t: string) => t.trim()).filter(Boolean),
    brief: str(content.briefDescription) ?? str(f.briefDescription),
    descriptionMd: md(content.detailedDescription_md),
    benefitsMd: md(content.benefits_md),
    exclusionsMd: md(content.exclusions_md),
    eligibilityMd: md(en.eligibilityCriteria?.eligibilityDescription_md),
    documentsMd: md(documents?.en?.documentsRequired_md),
    applicationMd,
    applicationModes: modes,
    applyUrl,
    references: (Array.isArray(content.references) ? content.references : [])
      .map((r: any) => ({ title: str(r?.title) ?? 'Reference', url: str(r?.url) ?? '' }))
      .filter((r: { url: string }) => /^https?:\/\//i.test(r.url)),
    benefitType: labelOf(content.benefitTypes),
    isDbt: typeof basic.dbtScheme === 'boolean' ? basic.dbtScheme : null,
    openDate: date(basic.schemeOpenDate),
    closeDate: date(basic.schemeCloseDate) ?? date(f.schemeCloseDate),
    rules: { version: 1, all: all.sort((a, b) => ORDER.indexOf(a.field) - ORDER.indexOf(b.field)) },
    reviewReasons: review,
  };
}

const ORDER: ProfileField[] = [
  'state', 'gender', 'age', 'caste', 'residence', 'annual_income', 'occupation', 'employment_status',
  'marital_status', 'student', 'disability', 'disability_percent', 'minority', 'bpl', 'gov_employee', 'economic_distress',
];
