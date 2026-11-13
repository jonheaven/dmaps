/** Land Standing/2 — non-consensus, deterministic. See spec.md §10–§11. */
import { districtOf, priorityCmp, isFinal } from "./codec.mjs";

export const VERSION = "land-standing/2";

/**
 * District Founder (§10.1): the live pin in the district with the lowest priority key, read
 * from the current cells. Not a record and not a privilege: a label anyone recomputes.
 * `final` is whether that pin can still be displaced (commit-first finality).
 */
export function founderOf(cells, district, tip) {
  let low = null;
  for (const c of Object.values(cells)) {
    if (districtOf(c.h3_cell) !== district) continue;
    if (!low || priorityCmp(c.key, low.key) < 0) low = c;
  }
  if (!low) return null;
  return { parcel: low.parcel, anchor_id: low.anchor_id, key: low.key, final: isFinal(low.key.height, tip) };
}

export function parcelScore(input) {
  const live_packs = Number(input.live_packs) || 0;
  const builds = Number(input.builds) || 0;
  const streak = Number(input.streak) || 0;
  const is_founder = input.is_founder ? 1 : 0;
  const district_peers = Number(input.district_peers) || 0;
  let neighborsTerm = 0;
  let neighbors_indexed = true;
  if (input.neighbors_indexed === false || input.neighbors == null) {
    neighbors_indexed = false;
  } else {
    neighborsTerm = 5 * (Number(input.neighbors) || 0);
  }
  const score =
    4 * live_packs +
    2 * Math.min(builds, 50) +
    3 * Math.min(streak, 365) +
    neighborsTerm +
    2 * Math.min(district_peers, 100) +
    25 * is_founder;
  return { version: VERSION, score, neighbors_indexed };
}

/** Consecutive doge-days with a live cell. 1440 blocks ≈ 1 day. */
export function streakFromHeights({ lastUnanchorHeight, tip, live }) {
  if (!live) return 0;
  const start = lastUnanchorHeight == null ? 0 : lastUnanchorHeight;
  const blocks = Math.max(0, tip - start);
  return Math.min(365, Math.floor(blocks / 1440));
}

export function districtStanding(parcelScores, liveAnchorCount) {
  const sum = parcelScores.reduce((a, p) => a + (typeof p === "number" ? p : p.score), 0);
  return sum + 10 * (liveAnchorCount || 0);
}

export function regionStanding(districtStandings) {
  return districtStandings.reduce((a, s) => a + s, 0);
}
