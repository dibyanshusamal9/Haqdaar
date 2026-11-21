/**
 * Recovering per-scheme numeric bounds (age, disability %) from myscheme's range filter.
 *
 * The search API filters ranges by OVERLAP: {min:a, max:b} returns every scheme whose
 * [lower, upper] interval overlaps [a, b]. So
 *   lowerSide(a) = filter [floor, a]  -> schemes with lower <= a
 *   upperSide(b) = filter [b, ceil]   -> schemes with upper >= b
 * Counting both sides for every integer tells us exactly where bounds sit ("rise" and
 * "drop" points). Fetching full membership at a chosen subset of those points then pins
 * each scheme's bound exactly when only one boundary point lies between two probes, and
 * to a small interval otherwise. All functions here are pure; the scraper does the I/O.
 */

export interface ProbeSet {
  at: number;
  slugs: string[];
}

export interface SideData {
  /** counts[i] = number of schemes for probe value domain[i] */
  domain: number[];
  counts: number[];
  probes: ProbeSet[];
}

export interface RangeProbeData {
  fetchedAt?: string;
  identifier: string;
  floor: number;
  ceil: number;
  universe: string[];
  lower: SideData;
  upper: SideData;
}

export interface Bound {
  value: number;
  /** true when the bound is exact; otherwise value is the most permissive candidate */
  exact: boolean;
  /** inclusive interval the true bound lies in */
  range: [number, number];
}

export interface ResolvedRange {
  lower: Bound | null;
  upper: Bound | null;
}

/** Values where the cumulative count changes, with the size of the change. */
export function boundaryPoints(side: Pick<SideData, 'domain' | 'counts'>, direction: 'rise' | 'drop') {
  const out: { at: number; delta: number }[] = [];
  for (let i = 0; i < side.domain.length; i++) {
    const prev = i === 0 ? (direction === 'rise' ? 0 : side.counts[0]) : side.counts[i - 1];
    const delta = direction === 'rise' ? side.counts[i] - prev : prev - side.counts[i];
    if (delta > 0) out.push({ at: side.domain[i], delta });
  }
  return out;
}

/**
 * Picks which boundary points to fetch in full: biggest boundaries first while the page
 * budget lasts. Cost of a probe is the number of 100-row pages its result set needs.
 */
export function chooseProbes(
  side: Pick<SideData, 'domain' | 'counts'>,
  direction: 'rise' | 'drop',
  budgetPages: number,
  alwaysInclude: number[] = [],
): number[] {
  const countAt = new Map(side.domain.map((d, i) => [d, side.counts[i]]));
  // For the upper side, the scheme set that "drops" at b is detected by probing b-1 vs b;
  // we probe at the drop point itself (schemes still present have upper >= b).
  const points = boundaryPoints(side, direction).sort((a, b) => b.delta - a.delta || a.at - b.at);
  const chosen = new Set<number>(alwaysInclude.filter((v) => countAt.has(v)));
  let spent = [...chosen].reduce((s, v) => s + Math.ceil((countAt.get(v) ?? 0) / 100), 0);
  for (const p of points) {
    if (chosen.has(p.at)) continue;
    const cost = Math.ceil((countAt.get(p.at) ?? 0) / 100);
    if (spent + cost > budgetPages) continue;
    chosen.add(p.at);
    spent += cost;
  }
  return [...chosen].sort((a, b) => a - b);
}

/** Resolves every scheme's [lower, upper] from the probe data. */
export function resolveRanges(data: RangeProbeData): Map<string, ResolvedRange> {
  const out = new Map<string, ResolvedRange>();
  const universe = new Set(data.universe);
  if (universe.size === 0) return out;

  const rises = boundaryPoints(data.lower, 'rise').map((p) => p.at);
  const drops = boundaryPoints(data.upper, 'drop').map((p) => p.at);
  // Schemes still present at the top of the domain have no upper limit we can see.
  const survivors = (data.upper.counts[data.upper.counts.length - 1] ?? 0) > 0;

  const lowerProbes = [...data.lower.probes].sort((a, b) => a.at - b.at).map((p) => ({ at: p.at, set: new Set(p.slugs) }));
  const upperProbes = [...data.upper.probes].sort((a, b) => a.at - b.at).map((p) => ({ at: p.at, set: new Set(p.slugs) }));

  for (const slug of universe) {
    out.set(slug, {
      lower: resolveLower(slug, lowerProbes, rises, data.floor),
      upper: resolveUpper(slug, upperProbes, drops, data.ceil, survivors),
    });
  }
  return out;
}

function resolveLower(
  slug: string,
  probes: { at: number; set: Set<string> }[],
  rises: number[],
  floor: number,
): Bound | null {
  // First probe that contains the scheme: lower <= probe.at, and lower > previous probe.
  let prevAt = floor - 1;
  let hitAt: number | null = null;
  for (const p of probes) {
    if (p.set.has(slug)) {
      hitAt = p.at;
      break;
    }
    prevAt = p.at;
  }
  const hi = hitAt ?? Number.POSITIVE_INFINITY;
  const candidates = rises.filter((r) => r > prevAt && r <= hi);
  if (candidates.length === 0) return null;
  const lo = candidates[0];
  // Known to start at the floor: no lower restriction. (If the floor is only one of
  // several candidates we still return the band, so the strict side is kept.)
  if (lo <= floor && candidates.length === 1) return null;
  return {
    value: lo, // most permissive: the smallest possible lower bound
    exact: candidates.length === 1,
    range: [lo, candidates[candidates.length - 1]],
  };
}

function resolveUpper(
  slug: string,
  probes: { at: number; set: Set<string> }[],
  drops: number[],
  ceil: number,
  survivors: boolean,
): Bound | null {
  // Last probe that still contains the scheme: upper >= probe.at; the next probe excludes it.
  let lastIn = -Infinity;
  let firstOut: number | null = null;
  for (const p of probes) {
    if (p.set.has(slug)) lastIn = p.at;
    else if (p.at > lastIn && firstOut === null && lastIn !== -Infinity) firstOut = p.at;
  }
  if (lastIn === -Infinity) {
    // Not in any probe: upper is below the first probe.
    firstOut = probes.length ? probes[0].at : null;
  }
  const lowEdge = lastIn === -Infinity ? Number.NEGATIVE_INFINITY : lastIn;
  const highEdge = firstOut ?? Number.POSITIVE_INFINITY;
  // A drop at b means upper == b - 1.
  const finite = drops.filter((b) => b > lowEdge && b <= highEdge).map((b) => b - 1);
  // Present in the highest probe: it may also be one of the schemes with no limit at all.
  const maybeUnbounded = firstOut === null && survivors;
  if (finite.length === 0) return null;
  if (maybeUnbounded) return { value: ceil, exact: false, range: [finite[0], ceil] };
  const hiVal = finite[finite.length - 1];
  return {
    value: hiVal, // most permissive: the largest possible upper bound
    exact: finite.length === 1,
    range: [finite[0], hiVal],
  };
}
