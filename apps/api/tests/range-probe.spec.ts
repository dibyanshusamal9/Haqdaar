import { chooseProbes, RangeProbeData, resolveRanges } from '../src/ingest/range-probe';

// Ground truth: [lower, upper]; 120 = no upper limit, 0 = no lower limit.
const TRUTH: Record<string, [number, number]> = {
  pension: [60, 120],
  youth: [18, 35],
  kanya: [0, 10],
  scholarship: [14, 25],
  open: [0, 120],
  midlife: [21, 40],
  worker: [18, 60],
  late: [18, 59],
};

/** Simulates what the myscheme overlap filter returns. */
function simulate(budgetLower: number, budgetUpper: number): RangeProbeData {
  const domain = Array.from({ length: 101 }, (_, i) => i);
  const lowerSet = (a: number) => Object.keys(TRUTH).filter((s) => TRUTH[s][0] <= a);
  const upperSet = (b: number) => Object.keys(TRUTH).filter((s) => TRUTH[s][1] >= b);
  const lowerCounts = domain.map((a) => lowerSet(a).length);
  const upperCounts = domain.map((b) => upperSet(b).length);
  // budgets here are in "pages"; every probe in this tiny fixture costs one page
  const lowerProbes = chooseProbes({ domain, counts: lowerCounts }, 'rise', budgetLower);
  const upperProbes = chooseProbes({ domain, counts: upperCounts }, 'drop', budgetUpper);
  return {
    identifier: 'age-general',
    floor: 0,
    ceil: 120,
    universe: Object.keys(TRUTH),
    lower: { domain, counts: lowerCounts, probes: lowerProbes.map((at) => ({ at, slugs: lowerSet(at) })) },
    upper: { domain, counts: upperCounts, probes: upperProbes.map((at) => ({ at, slugs: upperSet(at) })) },
  };
}

describe('resolveRanges', () => {
  it('recovers every bound exactly when every boundary is probed', () => {
    const r = resolveRanges(simulate(100, 100));
    for (const [slug, [lo, hi]] of Object.entries(TRUTH)) {
      const got = r.get(slug)!;
      expect(got.lower?.value ?? 0).toBe(lo);
      if (got.lower) expect(got.lower.exact).toBe(true);
      expect(got.upper?.value ?? 120).toBe(hi);
      if (got.upper) expect(got.upper.exact).toBe(true);
    }
  });

  it('with few probes, the true bound stays inside the reported range and the value is permissive', () => {
    const r = resolveRanges(simulate(2, 2));
    for (const [slug, [lo, hi]] of Object.entries(TRUTH)) {
      const got = r.get(slug)!;
      if (got.lower) {
        expect(lo).toBeGreaterThanOrEqual(got.lower.range[0]);
        expect(lo).toBeLessThanOrEqual(got.lower.range[1]);
        expect(got.lower.value).toBeLessThanOrEqual(lo); // never stricter than the truth
      } else {
        expect(lo).toBe(0);
      }
      if (got.upper) {
        expect(hi).toBeGreaterThanOrEqual(got.upper.range[0]);
        expect(hi).toBeLessThanOrEqual(got.upper.range[1]);
        expect(got.upper.value).toBeGreaterThanOrEqual(hi);
      }
    }
  });

  it('separates 59 from 60 when both boundaries are probed', () => {
    const r = resolveRanges(simulate(100, 100));
    expect(r.get('late')!.upper!.value).toBe(59);
    expect(r.get('worker')!.upper!.value).toBe(60);
  });

  it('reports no restriction for an open scheme', () => {
    const r = resolveRanges(simulate(100, 100));
    expect(r.get('open')).toEqual({ lower: null, upper: null });
  });
});
