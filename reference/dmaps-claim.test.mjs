import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateClaim, stakeFloor, dogemapsCell, burnScriptHex, parseBurnScript } from "./dmaps-claim.mjs";
import { OFFICIAL_CELLS } from "./dmaps-geo.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const conf = JSON.parse(readFileSync(join(here, "../protocols/dogemaps/vectors/conformance.json"), "utf8"));

test("claim vectors", () => {
  assert.ok(conf.claims.length >= 25);
  for (const c of conf.claims) {
    const r = validateClaim(c.body, c.tx, c.height, c.g);
    assert.equal(r.ok ? "pass" : "fail", c.expect, `${c.id}: ${c.description} (${r.why})`);
    if (c.expect === "fail") assert.equal(r.why, c.why, c.id);
  }
});

test("stake floor", () => {
  assert.equal(stakeFloor(0), 10000000n);
  assert.equal(stakeFloor(5000), 360000000n);
  assert.equal(stakeFloor(1e9), 360000000n);
  for (const f of conf.floors) assert.equal(stakeFloor(f.g).toString(), f.floor_koinu);
});

test("burn script round trip", () => {
  const s = burnScriptHex(123456789n);
  assert.equal(s.length, 38);
  assert.equal(parseBurnScript(s), 123456789n);
  assert.equal(parseBurnScript("6a4c11" + s.slice(4)), null);
  assert.equal(parseBurnScript(s.slice(0, 36)), null);
  assert.equal(parseBurnScript(s.toUpperCase()), 123456789n);
  assert.equal(parseBurnScript(s.slice(0, 36) + "zz"), null);
});

test("derived cells (h3-js 4.2.1)", () => {
  for (const c of OFFICIAL_CELLS) assert.equal(dogemapsCell(c.block_height, c.h3_res), c.h3_cell);
  for (const v of conf.vectors.filter((x) => x.expect === "cell")) assert.equal(dogemapsCell(v.block_height, v.h3_res), v.h3_cell);
  conf.geo_batch.forEach((cell, h) => assert.equal(dogemapsCell(h, 9), cell, String(h)));
});
