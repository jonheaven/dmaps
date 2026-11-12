import assert from "node:assert/strict";
import test from "node:test";
import { parcelScore, streakFromHeights, districtStanding, regionStanding, VERSION } from "./standing.mjs";

test("founder of a quiet district outscores a bare pin", () => {
  const founder = parcelScore({
    live_packs: 1,
    builds: 1,
    streak: 0,
    neighbors: 0,
    district_peers: 0,
    is_founder: true,
  });
  const later = parcelScore({
    live_packs: 1,
    builds: 1,
    streak: 0,
    neighbors: 0,
    district_peers: 1,
    is_founder: false,
  });
  assert.equal(founder.version, VERSION);
  assert.ok(founder.score > later.score);
  assert.equal(founder.score, 4 + 2 + 25);
});

test("neighbors and peers raise the cluster (flywheel)", () => {
  const lonely = parcelScore({ live_packs: 1, builds: 2, neighbors: 0, district_peers: 0 });
  const clustered = parcelScore({ live_packs: 1, builds: 2, neighbors: 2, district_peers: 5 });
  assert.ok(clustered.score > lonely.score);
});

test("omit neighbors rather than guess", () => {
  const a = parcelScore({ live_packs: 0, builds: 0, neighbors_indexed: false });
  assert.equal(a.neighbors_indexed, false);
  assert.equal(a.score, 0);
});

test("streak caps and resets when unanchored", () => {
  assert.equal(streakFromHeights({ live: false, tip: 10_000 }), 0);
  assert.equal(streakFromHeights({ live: true, lastUnanchorHeight: 0, tip: 1440 * 10 }), 10);
  assert.equal(streakFromHeights({ live: true, lastUnanchorHeight: 0, tip: 1440 * 400 }), 365);
});

test("district / region sums", () => {
  const d = districtStanding([{ score: 10 }, { score: 15 }], 3);
  assert.equal(d, 10 + 15 + 30);
  assert.equal(regionStanding([d, 20]), d + 20);
});
