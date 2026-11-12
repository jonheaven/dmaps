/** Land Standing/1 — non-consensus, deterministic. See spec.md §11. */

export const VERSION = "land-standing/1";

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
