import { z } from 'zod';

/**
 * The citizen profile: the only personal data Haqdaar.ai handles (NFR-05). Every field
 * maps to an eligibility attribute myscheme.gov.in tags schemes with, plus annual income.
 * Voice/text extraction fills it, the citizen reviews it, and the matcher reads it.
 */

// Spellings follow myscheme.gov.in so state rules compare by plain equality.
export const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
] as const;

export const GENDERS = ['female', 'male', 'transgender'] as const;
export const RESIDENCES = ['rural', 'urban'] as const;
export const CASTES = ['general', 'obc', 'sc', 'st', 'pvtg', 'dnt'] as const;
export const MARITAL_STATUSES = ['never_married', 'married', 'widowed', 'divorced', 'separated'] as const;
export const EMPLOYMENT_STATUSES = ['employed', 'self_employed', 'unemployed'] as const;
export const OCCUPATIONS = [
  'farmer', 'dairy_farmer', 'fisherman', 'construction_worker', 'unorganized_worker',
  'organized_worker', 'artisan_weaver', 'khadi_artisan', 'coir_worker', 'artist',
  'street_vendor', 'safai_karamchari', 'health_worker', 'teacher', 'student', 'sportsperson',
  'ex_serviceman', 'journalist', 'lawyer', 'other',
] as const;

export type State = (typeof STATES)[number];
export type Gender = (typeof GENDERS)[number];
export type Caste = (typeof CASTES)[number];
export type Occupation = (typeof OCCUPATIONS)[number];

export const LABELS = {
  gender: { female: 'Woman', male: 'Man', transgender: 'Transgender person' },
  residence: { rural: 'Rural', urban: 'Urban' },
  caste: {
    general: 'General', obc: 'OBC', sc: 'Scheduled Caste (SC)', st: 'Scheduled Tribe (ST)',
    pvtg: 'PVTG', dnt: 'De-notified / Nomadic (DNT)',
  },
  marital_status: {
    never_married: 'Never married', married: 'Married', widowed: 'Widowed',
    divorced: 'Divorced', separated: 'Separated',
  },
  employment_status: { employed: 'Employed', self_employed: 'Self-employed / entrepreneur', unemployed: 'Unemployed' },
  occupation: {
    farmer: 'Farmer', dairy_farmer: 'Dairy farmer', fisherman: 'Fisher', construction_worker: 'Construction worker',
    unorganized_worker: 'Unorganised-sector worker', organized_worker: 'Organised-sector worker',
    artisan_weaver: 'Artisan, spinner or weaver', khadi_artisan: 'Khadi artisan', coir_worker: 'Coir worker',
    artist: 'Artist', street_vendor: 'Street vendor', safai_karamchari: 'Safai karamchari',
    health_worker: 'Health worker', teacher: 'Teacher / faculty', student: 'Student', sportsperson: 'Sportsperson',
    ex_serviceman: 'Ex-serviceman', journalist: 'Journalist', lawyer: 'Lawyer / advocate', other: 'Other',
  },
} as const;

/** myscheme facet label -> our enum value. */
export const FACET_VALUE_MAP: Record<string, Record<string, string>> = {
  gender: { Female: 'female', Male: 'male', Transgender: 'transgender' },
  caste: {
    'Scheduled Caste (SC)': 'sc', 'Scheduled Tribe (ST)': 'st', 'Other Backward Class (OBC)': 'obc',
    General: 'general', 'Particularly Vulnerable Tribal Group (PVTG)': 'pvtg',
    'De-Notified, Nomadic, and Semi-Nomadic (DNT) communities': 'dnt',
  },
  residence: { Rural: 'rural', Urban: 'urban' },
  maritalStatus: {
    'Never Married': 'never_married', Married: 'married', Widowed: 'widowed', Divorced: 'divorced', Separated: 'separated',
  },
  employmentStatus: { Employed: 'employed', 'Self-Employed/ Entrepreneur': 'self_employed', Unemployed: 'unemployed' },
  occupation: {
    Farmer: 'farmer', 'Dairy Farmer': 'dairy_farmer', Fishermen: 'fisherman', 'Construction Worker': 'construction_worker',
    'Unorganized Worker': 'unorganized_worker', 'Organized Worker': 'organized_worker',
    'Artisans, Spinners & Weavers': 'artisan_weaver', 'Khadi Artisan': 'khadi_artisan', 'Coir Worker': 'coir_worker',
    Artists: 'artist', 'Street Vendor': 'street_vendor', 'Safai Karamchari': 'safai_karamchari',
    'Health Worker': 'health_worker', 'Teacher / Faculty': 'teacher', Student: 'student', Sportsperson: 'sportsperson',
    'Ex Servicemen': 'ex_serviceman', Journalist: 'journalist', 'Lawyer / Law Graduate / Advocate': 'lawyer',
  },
};

export const ProfileSchema = z.object({
  age: z.number().int().min(0).max(120),
  gender: z.enum(GENDERS),
  state: z.enum(STATES),
  residence: z.enum(RESIDENCES),
  caste: z.enum(CASTES),
  annual_income: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
  marital_status: z.enum(MARITAL_STATUSES).nullable().default(null),
  occupation: z.enum(OCCUPATIONS).nullable().default(null),
  employment_status: z.enum(EMPLOYMENT_STATUSES).nullable().default(null),
  student: z.boolean().default(false),
  disability: z.boolean().default(false),
  disability_percent: z.number().int().min(0).max(100).nullable().default(null),
  minority: z.boolean().default(false),
  bpl: z.boolean().default(false),
  gov_employee: z.boolean().default(false),
  economic_distress: z.boolean().default(false),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileField = keyof Profile;

export const REQUIRED_FIELDS: ProfileField[] = ['age', 'gender', 'state', 'residence', 'caste'];
export const PROFILE_FIELDS = Object.keys(ProfileSchema.shape) as ProfileField[];

// ---------------------------------------------------------------------------
// Normalisation: forgiving input (form strings, LLM output, aliases) -> typed values.
// ---------------------------------------------------------------------------

const STATE_ALIASES: Record<string, State> = {
  up: 'Uttar Pradesh', mp: 'Madhya Pradesh', ap: 'Andhra Pradesh', hp: 'Himachal Pradesh',
  wb: 'West Bengal', tn: 'Tamil Nadu', jk: 'Jammu and Kashmir', 'j&k': 'Jammu and Kashmir',
  'jammu & kashmir': 'Jammu and Kashmir', orissa: 'Odisha', pondicherry: 'Puducherry',
  'new delhi': 'Delhi', 'nct of delhi': 'Delhi', uttaranchal: 'Uttarakhand', chattisgarh: 'Chhattisgarh',
  'andaman & nicobar': 'Andaman and Nicobar Islands', 'andaman and nicobar': 'Andaman and Nicobar Islands',
  'dadra and nagar haveli': 'Dadra & Nagar Haveli and Daman & Diu', 'daman and diu': 'Dadra & Nagar Haveli and Daman & Diu',
  'dadra and nagar haveli and daman and diu': 'Dadra & Nagar Haveli and Daman & Diu',
  telengana: 'Telangana', 'tamilnadu': 'Tamil Nadu',
};

const ENUM_ALIASES: Record<string, Record<string, string>> = {
  gender: {
    f: 'female', woman: 'female', women: 'female', girl: 'female', mahila: 'female', lady: 'female',
    m: 'male', man: 'male', men: 'male', boy: 'male', purush: 'male',
    trans: 'transgender', 'third gender': 'transgender', other: 'transgender',
  },
  residence: { village: 'rural', gaon: 'rural', city: 'urban', town: 'urban', shahar: 'urban' },
  caste: {
    gen: 'general', 'general category': 'general', ews: 'general', 'other backward class': 'obc',
    'other backward classes': 'obc', 'scheduled caste': 'sc', dalit: 'sc', 'scheduled tribe': 'st',
    adivasi: 'st', tribal: 'st', 'particularly vulnerable tribal group': 'pvtg', 'de-notified': 'dnt',
    nomadic: 'dnt', 'denotified tribe': 'dnt',
  },
  marital_status: {
    single: 'never_married', unmarried: 'never_married', 'never married': 'never_married',
    widow: 'widowed', widower: 'widowed', divorcee: 'divorced',
  },
  employment_status: {
    'self employed': 'self_employed', 'self-employed': 'self_employed', business: 'self_employed',
    entrepreneur: 'self_employed', job: 'employed', jobless: 'unemployed',
  },
  occupation: {
    farming: 'farmer', kisan: 'farmer', agriculture: 'farmer', fisher: 'fisherman', fishermen: 'fisherman',
    fisherwoman: 'fisherman', 'construction labour': 'construction_worker', mason: 'construction_worker',
    labourer: 'unorganized_worker', labour: 'unorganized_worker', 'daily wage': 'unorganized_worker',
    weaver: 'artisan_weaver', artisan: 'artisan_weaver', craftsman: 'artisan_weaver', spinner: 'artisan_weaver',
    vendor: 'street_vendor', hawker: 'street_vendor', 'ex-serviceman': 'ex_serviceman', veteran: 'ex_serviceman',
    advocate: 'lawyer', 'asha worker': 'health_worker', 'anganwadi worker': 'health_worker', none: 'other',
  },
};

function key(v: string) {
  return v.toLowerCase().replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normaliseState(v: unknown): State | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const k = key(v);
  const direct = STATES.find((s) => key(s) === k);
  if (direct) return direct;
  return STATE_ALIASES[k] ?? STATE_ALIASES[k.replace(/&/g, 'and')] ?? null;
}

function normaliseEnum<T extends string>(field: string, values: readonly T[], v: unknown): T | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const k = key(v);
  const snake = k.replace(/[\s-]+/g, '_');
  if ((values as readonly string[]).includes(snake)) return snake as T;
  const alias = ENUM_ALIASES[field]?.[k];
  return alias && (values as readonly string[]).includes(alias) ? (alias as T) : null;
}

/** "2.5 lakh", "₹1,20,000", "15000 per month", 250000 -> rupees per year. */
export function parseRupees(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  if (typeof v !== 'string') return null;
  const s = v.toLowerCase().replace(/,/g, '').replace(/₹|rs\.?|inr|rupees?/g, ' ').trim();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|crores?|cr\b|k\b|thousand)?/);
  if (!m) return null;
  let n = Number(m[1]);
  const unit = m[2] ?? '';
  if (/^(lakh|lac|l)/.test(unit)) n *= 100_000;
  else if (/^(crore|cr)/.test(unit)) n *= 10_000_000;
  else if (/^(k|thousand)/.test(unit)) n *= 1000;
  if (/per month|monthly|a month|\/month|pm\b/.test(s)) n *= 12;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string' && v.trim() !== '' && /^\d+(\.\d+)?$/.test(v.trim())) return Math.round(Number(v));
  return null;
}

function toBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const k = key(v);
    if (['yes', 'true', 'y', '1', 'haan', 'ha'].includes(k)) return true;
    if (['no', 'false', 'n', '0', 'nahi', 'nahin'].includes(k)) return false;
  }
  return null;
}

export interface NormalisedProfile {
  /** Fields that parsed cleanly; anything unparseable is dropped, never guessed. */
  values: Partial<Profile>;
  invalid: ProfileField[];
}

/** Coerces loose input into typed profile values, field by field. */
export function normaliseProfileInput(input: Record<string, unknown>): NormalisedProfile {
  const values: Partial<Profile> = {};
  const invalid: ProfileField[] = [];
  const set = <K extends ProfileField>(f: K, v: Profile[K] | null, raw: unknown) => {
    if (raw === undefined || raw === null || raw === '') return;
    if (v === null) invalid.push(f);
    else values[f] = v;
  };

  const age = toInt(input.age);
  set('age', age !== null && age >= 0 && age <= 120 ? age : null, input.age);
  set('gender', normaliseEnum('gender', GENDERS, input.gender), input.gender);
  set('state', normaliseState(input.state), input.state);
  set('residence', normaliseEnum('residence', RESIDENCES, input.residence), input.residence);
  set('caste', normaliseEnum('caste', CASTES, input.caste), input.caste);
  set('annual_income', parseRupees(input.annual_income), input.annual_income);
  set('marital_status', normaliseEnum('marital_status', MARITAL_STATUSES, input.marital_status), input.marital_status);
  set('occupation', normaliseEnum('occupation', OCCUPATIONS, input.occupation), input.occupation);
  set('employment_status', normaliseEnum('employment_status', EMPLOYMENT_STATUSES, input.employment_status), input.employment_status);
  const pct = toInt(input.disability_percent);
  set('disability_percent', pct !== null && pct >= 0 && pct <= 100 ? pct : null, input.disability_percent);
  for (const f of ['student', 'disability', 'minority', 'bpl', 'gov_employee', 'economic_distress'] as const) {
    set(f, toBool(input[f]), input[f]);
  }
  return { values, invalid };
}

/**
 * Builds the JSON the SQL matcher evaluates. Hierarchies are expanded here so rules stay
 * plain set membership: a PVTG citizen also satisfies "ST" rules, a dairy farmer "farmer".
 */
export function toMatchDocument(p: Profile): Record<string, unknown> {
  const caste: string[] = [p.caste];
  if (p.caste === 'pvtg') caste.push('st');
  const occupation: string[] | null = p.occupation ? [p.occupation] : null;
  if (occupation && p.occupation === 'dairy_farmer') occupation.push('farmer');
  if (occupation && p.occupation === 'khadi_artisan') occupation.push('artisan_weaver');
  if (occupation && p.student && !occupation.includes('student')) occupation.push('student');
  return {
    ...p,
    caste,
    occupation,
    disability_percent: p.disability ? p.disability_percent : 0,
  };
}
