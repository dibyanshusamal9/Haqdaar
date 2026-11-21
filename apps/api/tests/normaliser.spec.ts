import { FacetIndex, normaliseScheme } from '../src/ingest/normaliser';
import { SearchHit } from '../src/ingest/myscheme.client';

const hit = (slug: string, extra: Partial<SearchHit['fields']> = {}): SearchHit => ({
  id: slug,
  fields: { slug, schemeName: `Scheme ${slug}`, level: 'State', beneficiaryState: ['Bihar'], ...extra },
});

const detail = (eligibility: string, extra: Record<string, unknown> = {}) => ({
  _id: 'abc123',
  en: {
    basicDetails: { schemeName: 'Mukhyamantri Example Yojana', level: { value: 'state', label: 'State' }, ...extra },
    schemeContent: { briefDescription: 'Brief', benefits_md: '1. ₹10,000 per year' },
    eligibilityCriteria: { eligibilityDescription_md: eligibility },
    applicationProcess: [{ mode: 'Online', url: ' https://apply.example.gov.in ', process_md: 'Apply online.' }],
  },
});

const facets = (entries: Record<string, Record<string, string[]>>): FacetIndex =>
  Object.fromEntries(
    Object.entries(entries).map(([id, byValue]) => [id, Object.fromEntries(Object.entries(byValue).map(([v, s]) => [v, new Set(s)]))]),
  );

describe('normaliseScheme', () => {
  it('turns facets into hard predicates', () => {
    const r = normaliseScheme({
      hit: hit('kanya'),
      detail: detail('Girls of SC/ST families in Bihar.'),
      documents: null,
      facets: facets({ gender: { Female: ['kanya'] }, caste: { 'Scheduled Caste (SC)': ['kanya'], 'Scheduled Tribe (ST)': ['kanya'] }, isStudent: { Yes: ['kanya'] } }),
      age: undefined,
      disability: undefined,
    });
    const byField = Object.fromEntries(r.rules.all.map((p) => [p.field, p]));
    expect(byField.state).toMatchObject({ op: 'in', value: ['Bihar'], src: 'myscheme-facet' });
    expect(byField.gender).toMatchObject({ op: 'in', value: ['female'], label: 'For women' });
    expect(byField.caste).toMatchObject({ op: 'in', value: ['sc', 'st'] });
    expect(byField.student).toMatchObject({ op: 'eq', value: true });
    expect(r.level).toBe('state');
    expect(r.applyUrl).toBe('https://apply.example.gov.in');
    expect(r.sourceUrl).toBe('https://www.myscheme.gov.in/schemes/kanya');
    expect(r.reviewReasons).toEqual([]);
  });

  it('makes the loose employment tag advisory, never excluding', () => {
    const r = normaliseScheme({
      hit: hit('kisan'),
      detail: detail('Landholding farmer families.'),
      documents: null,
      facets: facets({ employmentStatus: { Employed: ['kisan'] }, occupation: { Farmer: ['kisan'] } }),
      age: undefined,
      disability: undefined,
    });
    expect(r.rules.all.find((p) => p.field === 'employment_status')).toMatchObject({ value: ['employed'], strength: 'soft' });
    expect(r.rules.all.find((p) => p.field === 'occupation')?.strength).toBeUndefined();
  });

  it('skips a facet that lists every possible value', () => {
    const r = normaliseScheme({
      hit: hit('all-genders', { beneficiaryState: ['All'] }),
      detail: detail('Anyone.'),
      documents: null,
      facets: facets({ gender: { Female: ['all-genders'], Male: ['all-genders'], Transgender: ['all-genders'] } }),
      age: undefined,
      disability: undefined,
    });
    expect(r.rules.all).toEqual([]);
    expect(r.states).toEqual([]);
  });

  it('uses the text to pin an approximate myscheme age bound', () => {
    const r = normaliseScheme({
      hit: hit('youth'),
      detail: detail('The applicant should be aged between 18 and 35 years.'),
      documents: null,
      facets: {},
      age: { lower: { value: 18, exact: true, range: [18, 18] }, upper: { value: 40, exact: false, range: [35, 40] } },
      disability: undefined,
    });
    const age = r.rules.all.find((p) => p.field === 'age')!;
    expect(age.value).toEqual([18, 35]);
    expect(age.strict).toBeUndefined();
  });

  it('keeps an uncertain band as strict vs permissive when the text cannot resolve it', () => {
    const r = normaliseScheme({
      hit: hit('band'),
      detail: detail('Residents of Bihar.'),
      documents: null,
      facets: {},
      age: { lower: null, upper: { value: 40, exact: false, range: [35, 40] } },
      disability: undefined,
    });
    const age = r.rules.all.find((p) => p.field === 'age')!;
    expect(age.value).toEqual([0, 40]);
    expect(age.strict).toEqual([0, 35]);
  });

  it('adds an income ceiling from the eligibility text', () => {
    const r = normaliseScheme({
      hit: hit('income'),
      detail: detail('Annual family income should not exceed ₹2,00,000.'),
      documents: null,
      facets: {},
      age: undefined,
      disability: undefined,
    });
    expect(r.rules.all.find((p) => p.field === 'annual_income')).toMatchObject({ op: 'lte', value: 200000, src: 'eligibility-text' });
  });

  it('flags what it cannot normalise instead of guessing', () => {
    const r = normaliseScheme({
      hit: hit('vague'),
      detail: detail('Family income should be below the limit notified by the department.'),
      documents: null,
      facets: {},
      age: undefined,
      disability: undefined,
    });
    expect(r.rules.all.some((p) => p.field === 'annual_income')).toBe(false);
    expect(r.reviewReasons.join(' ')).toMatch(/income condition/);
  });

  it('flags schemes whose page myscheme does not return', () => {
    const r = normaliseScheme({ hit: hit('nodetail'), detail: null, documents: null, facets: {}, age: undefined, disability: undefined });
    expect(r.reviewReasons[0]).toMatch(/returned no scheme page/);
    expect(r.name).toBe('Scheme nodetail');
  });

  it('makes text-only age bounds soft', () => {
    const r = normaliseScheme({
      hit: hit('soft'),
      detail: detail('Applicant must be aged between 21 and 45 years.'),
      documents: null,
      facets: {},
      age: undefined,
      disability: undefined,
    });
    expect(r.rules.all.find((p) => p.field === 'age')).toMatchObject({ value: [21, 45], strength: 'soft', src: 'eligibility-text' });
  });
});
