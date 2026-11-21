import { moneyValue, parseAge, parseIncome } from '../src/ingest/eligibility-text';

describe('parseIncome', () => {
  it('reads a lakh ceiling', () => {
    expect(parseIncome('The annual family income should not exceed ₹2.5 lakh.').ceilings).toEqual([250000]);
  });

  it('reads Indian digit grouping and Rs.', () => {
    expect(parseIncome('Annual income of the family must be less than Rs. 2,50,000/-').ceilings).toEqual([250000]);
  });

  it('annualises monthly limits', () => {
    expect(parseIncome('Family income up to ₹10,000 per month.').ceilings).toEqual([120000]);
  });

  it('keeps category-wise limits so the normaliser can use a strict band', () => {
    const r = parseIncome('Income limit: ₹2.5 lakh for SC/ST and ₹1.5 lakh for others.');
    expect(r.ceilings).toEqual([150000, 250000]);
  });

  it('flags an income condition without a number', () => {
    const r = parseIncome('Family income should be within the limit fixed by the State Government.');
    expect(r.ceilings).toEqual([]);
    expect(r.unparsed).toBe(true);
  });

  it('ignores income-tax clauses and texts with no income at all', () => {
    expect(parseIncome('The applicant should not be an income tax payer.').ceilings).toEqual([]);
    expect(parseIncome('The applicant must be a resident of Goa.')).toEqual({ ceilings: [], unparsed: false });
  });

  it('does not treat a minimum income as a ceiling', () => {
    const r = parseIncome('Annual income should be more than ₹5,00,000.');
    expect(r.ceilings).toEqual([]);
  });

  // Real phrasings from the scraped corpus that an earlier version missed.
  it('treats "should not be more than" as a ceiling', () => {
    expect(parseIncome('The annual family income of the student should not be more than ₹6,00,000/- (for both Rural Areas & Urban Areas).').ceilings).toEqual([600000]);
    expect(parseIncome('Family Annual Income should not be more than Rs. 72,000/- per annum.').ceilings).toEqual([72000]);
  });

  it('decodes HTML entities such as &lt;', () => {
    expect(parseIncome('the non-BPL category with annual income &lt; ₹1,20,000/-.').ceilings).toEqual([120000]);
  });

  it('reads an exclusion above an amount as a ceiling', () => {
    expect(parseIncome('The applicant is not eligible if the monthly family income exceeds ₹22,000/-.').ceilings).toEqual([264000]);
  });

  it('reads an exclusion below an amount as a minimum, not a ceiling', () => {
    const r = parseIncome('Applicants whose annual family income is below ₹50,000 are not eligible.');
    expect(r.ceilings).toEqual([]);
    expect(r.unparsed).toBe(true);
  });

  it('keeps small monthly limits once annualised', () => {
    expect(parseIncome('The income of the family of the Child is less than ₹ 500/- per month.').ceilings).toEqual([6000]);
  });

  it('ignores "no income limit" instead of flagging it', () => {
    expect(parseIncome('There is no income limit to apply under the scheme.')).toEqual({ ceilings: [], unparsed: false });
    expect(parseIncome('There is no upper limit on annual income for availing of the pension.')).toEqual({ ceilings: [], unparsed: false });
  });

  it('converts units', () => {
    expect(moneyValue('1', 'crore')).toBe(10_000_000);
    expect(moneyValue('2.5', 'L')).toBe(250_000);
    expect(moneyValue('1,20,000', undefined)).toBe(120_000);
  });
});

describe('parseAge', () => {
  it('reads a between range', () => {
    expect(parseAge('Applicant should be aged between 18 and 40 years.')).toEqual({ lower: 18, upper: 40, ambiguous: false });
  });

  it('reads a range with words between the numbers (PMSBY wording)', () => {
    const text =
      'Individual bank account holders of participating banks aged between 18 years (completed) and 70 years (age nearer birthday) who give their consent to join.';
    expect(parseAge(text)).toMatchObject({ lower: 18, upper: 70 });
  });

  it('reads "between X and Y years of age" without "age" before it', () => {
    expect(parseAge('The applicant should be between 21 and 45 years of age.')).toMatchObject({ lower: 21, upper: 45 });
  });

  it('ignores number ranges that are not about age', () => {
    expect(parseAge('Loans between 10 and 50 years tenure are not covered.')).toMatchObject({ lower: null, upper: null });
  });

  it('reads a dash range', () => {
    expect(parseAge('Age: 18-35 years')).toMatchObject({ lower: 18, upper: 35 });
  });

  it('reads one-sided bounds', () => {
    expect(parseAge('The applicant must be of age 60 years and above.')).toMatchObject({ lower: 60, upper: null });
    expect(parseAge('Minimum age of 21 years.')).toMatchObject({ lower: 21 });
    expect(parseAge('Applicants aged below 18 years')).toMatchObject({ upper: 17 });
  });

  it('marks conflicting bounds ambiguous instead of picking one', () => {
    const r = parseAge('Minimum age 18 years. For women, minimum age 21 years.');
    expect(r.lower).toBeNull();
    expect(r.ambiguous).toBe(true);
  });

  it('returns nothing for text without ages', () => {
    expect(parseAge('Must be a resident of Kerala.')).toEqual({ lower: null, upper: null, ambiguous: false });
  });
});
