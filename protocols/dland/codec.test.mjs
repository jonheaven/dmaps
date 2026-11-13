import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  parse,
  isCell,
  h3Resolution,
  h3Parent,
  districtOf,
  regionOf,
  H3_ANCHOR_RES,
  H3_DISTRICT_RES,
  H3_REGION_RES,
  authorize,
  canTakeCell,
  cooldownOk,
  isFinal,
  WINDOW,
  REANCHOR_COOLDOWN,
} from "./codec.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const conf = JSON.parse(readFileSync(join(here, "vectors", "conformance.json"), "utf8"));
const CELL = "8c28308280f37ff";

test("H3: example cell, its district and region (h3-js 4.2.1 cellToParent)", () => {
  assert.equal(isCell(CELL, 12), true);
  assert.equal(h3Resolution(CELL), H3_ANCHOR_RES);
  assert.equal(districtOf(CELL), "872830828ffffff");
  assert.equal(regionOf(CELL), "8428309ffffffff");
  assert.equal(h3Resolution(districtOf(CELL)), H3_DISTRICT_RES);
  assert.equal(h3Parent(districtOf(CELL), H3_REGION_RES), regionOf(CELL));
  assert.equal(isCell("8928308280fffff", 12), false);
  assert.equal(h3Resolution("8928308280fffff"), 9);
});

test("H3 vectors: parents and invalid cells", () => {
  for (const c of conf.h3) {
    assert.equal(isCell(c.cell, 12), c.valid, c.cell);
    assert.equal(districtOf(c.cell), c.district, c.cell);
    assert.equal(regionOf(c.cell), c.region, c.cell);
  }
  for (const c of conf.invalid_cells) assert.equal(isCell(c.cell, 12), c.valid_res12, c.cell);
  for (const c of conf.invalid_cells) assert.equal(c.valid_res12, false, c.cell);
});

test("examples parse", () => {
  for (const f of ["pack-valid.json", "build-valid.json", "anchor-valid.json"]) {
    const r = parse(readFileSync(join(here, "examples", f), "utf8"));
    assert.equal(r.ok, true, f + " " + r.why);
  }
});

test("parse vectors", () => {
  assert.ok(conf.parse.length >= 50);
  for (const c of conf.parse) {
    const r = parse(c.body);
    assert.equal(r.ok ? "pass" : "fail", c.expect, `${c.id}: ${c.description} (${r.why})`);
    if (c.expect === "fail") assert.equal(r.why, c.why, c.id);
  }
});

test("seal without content keeps live content; name is verbatim", () => {
  const T = "a".repeat(64) + "i0";
  const r = parse(JSON.stringify({ p: "Ð:LAND", v: "1", op: "build", parcel: 1, title: T, pack: T, seal: true }));
  assert.equal(r.ok, true);
  assert.equal(r.content, undefined);
  const p = parse(JSON.stringify({ p: "Ð:LAND", v: "1", op: "pack", name: " x ", version: "1", schema: {} }));
  assert.equal(p.name, " x ");
});

test("authorization vectors (T1–T5, vin[0], same-tx title)", () => {
  for (const c of conf.authorize) {
    const r = authorize(c.facts);
    assert.equal(r.ok ? "pass" : "fail", c.expect, c.id);
    if (c.expect === "fail") assert.equal(r.why, c.why, c.id);
  }
});

test("commit-first cell vectors (T6/T7)", () => {
  for (const c of conf.cell) assert.equal(canTakeCell(c.existing, c.incoming, c.tip), c.can_take, c.id);
  assert.equal(isFinal(10, 10 + WINDOW), false);
  assert.equal(isFinal(10, 10 + WINDOW + 1), true);
});

test("cooldown", () => {
  assert.equal(cooldownOk(null, 0), true);
  assert.equal(cooldownOk(10, 10 + REANCHOR_COOLDOWN - 1), false);
  assert.equal(cooldownOk(10, 10 + REANCHOR_COOLDOWN), true);
});
