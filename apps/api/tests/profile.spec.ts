import { normaliseProfileInput, parseRupees, ProfileSchema, toMatchDocument } from '../src/domain/profile';
import { extractWithRules } from '../src/profile/rule-extractor';
import { rank } from '../src/match/ranking';

describe('normaliseProfileInput', () => {
  it('accepts aliases and loose values', () => {
    const { values, invalid } = normaliseProfileInput({
      age: '34', gender: 'Woman', state: 'UP', residence: 'village', caste: 'Scheduled Caste',
      annual_income: '1.2 lakh', student: 'no', bpl: 'yes', occupation: 'kisan',
    });
    expect(invalid).toEqual([]);
    expect(values).toEqual({
      age: 34, gender: 'female', state: 'Uttar Pradesh', residence: 'rural', caste: 'sc',
      annual_income: 120000, student: false, bpl: true, occupation: 'farmer',
    });
  });

  it('reports unreadable values instead of guessing', () => {
    const { values, invalid } = normaliseProfileInput({ age: 'old', state: 'Atlantis', gender: 'female' });
    expect(values).toEqual({ gender: 'female' });
    expect(invalid.sort()).toEqual(['age', 'state']);
  });

  it('parses rupee amounts', () => {
    expect(parseRupees('₹2,50,000')).toBe(250000);
    expect(parseRupees('8000 per month')).toBe(96000);
    expect(parseRupees('3 lakhs')).toBe(300000);
    expect(parseRupees('nothing')).toBeNull();
  });
});

describe('toMatchDocument', () => {
  const base = ProfileSchema.parse({ age: 40, gender: 'female', state: 'Odisha', residence: 'rural', caste: 'pvtg' });

  it('expands PVTG to also satisfy ST rules', () => {
    expect(toMatchDocument(base).caste).toEqual(['pvtg', 'st']);
  });

  it('expands dairy farmer to farmer', () => {
    expect(toMatchDocument({ ...base, occupation: 'dairy_farmer' }).occupation).toEqual(['dairy_farmer', 'farmer']);
  });

  it('treats a non-disabled citizen as 0% disability', () => {
    expect(toMatchDocument(base).disability_percent).toBe(0);
  });
});

describe('extractWithRules', () => {
  it('extracts the reported Hindi age and compound income without a model', () => {
    expect(extractWithRules('उम्र पचपन साल है, वार्षिक आय एक लाख बीस हज़ार रुपये है।'))
      .toEqual({ age: 55, annual_income: 120000 });
  });

  it('supports Hindi number words and retains mixed digit income units', () => {
    expect(extractWithRules('उम्र पैंतीस साल है, आय साठ हजार रुपये है।'))
      .toMatchObject({ age: 35, annual_income: 60000 });
    expect(extractWithRules('उम्र ५५ साल है, आय २ लाख है।'))
      .toMatchObject({ age: 55, annual_income: 200000 });
    expect(extractWithRules('आय बारह हजार रुपये प्रति महीने है।').annual_income).toBe(144000);
    expect(extractWithRules('आय डेढ़ लाख रुपये है।').annual_income).toBeUndefined();
    expect(extractWithRules('आय सवा एक लाख रुपये है।').annual_income).toBeUndefined();
  });

  it('reads an English description', () => {
    const f = extractWithRules('I am a 45 year old woman farmer from a village in Bihar. We are SC and our income is 80,000 a year. I am a widow.');
    expect(f).toMatchObject({
      age: 45, gender: 'female', state: 'Bihar', residence: 'rural', caste: 'sc', occupation: 'farmer',
      annual_income: 80000, marital_status: 'widowed',
    });
  });

  it('reads Devanagari Hindi', () => {
    const f = extractWithRules('मेरी उम्र ६२ साल है, मैं राजस्थान के गांव में रहता हूँ, किसान हूँ, आय 1 लाख है');
    expect(f).toMatchObject({ age: 62, state: 'Rajasthan', residence: 'rural', occupation: 'farmer', annual_income: 100000 });
  });

  it('respects negation', () => {
    const f = extractWithRules('I am not a student and I have no disability');
    expect(f.student).toBe(false);
    expect(f.disability).toBe(false);
  });

  it('reads a real Sarvam transcript (hyphenated age, rupee symbol, craft work)', () => {
    const f = extractWithRules(
      'I am a 32-year-old woman from Lucknow in Uttar Pradesh. I live in the city. I do embroidery work from home. I am Muslim. Our family income is ₹1,20,000 a year.',
    );
    expect(f).toMatchObject({
      age: 32, gender: 'female', state: 'Uttar Pradesh', residence: 'urban', occupation: 'artisan_weaver',
      minority: true, annual_income: 120000,
    });
  });

  it('annualises a monthly income', () => {
    expect(extractWithRules('my income is 9000 per month').annual_income).toBe(108000);
  });
});

describe('rank', () => {
  const profile = ProfileSchema.parse({ age: 20, gender: 'female', state: 'Kerala', residence: 'urban', caste: 'obc', student: true });
  const p = (field: any) => ({ id: field, field, op: 'eq' as const, value: true, src: 'myscheme-facet' as const, label: field });
  const cands = [
    { slug: 'b-generic', name: 'Generic', status: 'eligible' as const, passed: [], verify: [], categories: [], closeDate: null },
    { slug: 'a-scholar', name: 'Scholarship', status: 'eligible' as const, passed: [p('student'), p('gender')], verify: [], categories: ['Education & Learning'], closeDate: null },
    { slug: 'c-closed', name: 'Closed', status: 'eligible' as const, passed: [p('student'), p('gender'), p('caste')], verify: [], categories: [], closeDate: '2020-01-01' },
    { slug: 'd-likely', name: 'Likely', status: 'likely' as const, passed: [p('student')], verify: [p('annual_income')], categories: [], closeDate: null },
  ];

  it('puts targeted open schemes first and closed ones last', () => {
    expect(rank(cands, profile, '2026-10-11').map((c) => c.slug)).toEqual(['a-scholar', 'd-likely', 'b-generic', 'c-closed']);
  });

  it('is deterministic regardless of input order', () => {
    const forward = rank(cands, profile, '2026-10-11').map((c) => c.slug);
    const reversed = rank([...cands].reverse(), profile, '2026-10-11').map((c) => c.slug);
    expect(reversed).toEqual(forward);
  });
});
