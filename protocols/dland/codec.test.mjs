import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  parse,
  parseH3Cell,
  h3Resolution,
  h3Parent,
  districtOf,
  regionOf,
  H3_ANCHOR_RES,
  H3_DISTRICT_RES,
  H3_REGION_RES,
  authorize,
  applyBuild,
  applyAnchor,
  canTakeCell,
  cooldownOk,
  isFinal,
  WINDOW,
  REANCHOR_COOLDOWN,
} from "./codec.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const TITLE = "a".repeat(64) + "i0";
const PACK = "b".repeat(64) + "i0";
const CELL = "8c28308280f37ff";

test("H3 example cell is res 12 mode 1 and has district/region parents", () => {
  assert.equal(parseH3Cell(CELL, 12), CELL);
  assert.equal(h3Resolution(CELL), H3_ANCHOR_RES);
  const d = districtOf(CELL);
  const r = regionOf(CELL);
  assert.equal(h3Resolution(d), H3_DISTRICT_RES);
  assert.equal(h3Resolution(r), H3_REGION_RES);
  // parent of parent
  assert.equal(h3Parent(d, H3_REGION_RES), r);
  // Reject res 9 overlay cells as anchors
  assert.equal(parseH3Cell("8928308280fffff", 12), null);
  assert.equal(h3Resolution("8928308280fffff"), 9);
});

test("pack / build / anchor examples parse", () => {
  for (const f of ["pack-valid.json", "build-valid.json", "anchor-valid.json"]) {
    const j = readFileSync(join(here, "examples", f), "utf8");
    const r = parse(j);
    assert.equal(r.ok, true, f + " " + r.why);
  }
});

test("pack requires schema or schema_uri", () => {
  assert.equal(parse(JSON.stringify({ p: "Ð:LAND", v: "1", op: "pack", name: "x", version: "1" })).ok, false);
  assert.equal(
    parse(JSON.stringify({ p: "Ð:LAND", v: "1", op: "pack", name: "x", version: "1", schema_uri: "ipfs://z" })).ok,
    true,
  );
});

test("build requires title + pack + content (unless remove/seal)", () => {
  const base = { p: "Ð:LAND", v: "1", op: "build", parcel: 1, title: TITLE, pack: PACK };
  assert.equal(parse(JSON.stringify(base)).ok, false);
  assert.equal(parse(JSON.stringify({ ...base, content: { a: 1 } })).ok, true);
  assert.equal(parse(JSON.stringify({ ...base, remove: true })).ok, true);
  assert.equal(parse(JSON.stringify({ ...base, remove: true, content: { a: 1 } })).ok, false);
});

test("authorization policy: spend + committed + current title (T1–T5)", () => {
  const good = {
    committed: true,
    spends_title_outpoint: true,
    title_is_canonical: true,
    body_title: TITLE,
    canonical_title: TITLE,
    stale_outpoint: false,
  };
  assert.equal(authorize(good).ok, true);
  assert.equal(authorize({ ...good, committed: false }).why, "unbound");
  assert.equal(authorize({ ...good, spends_title_outpoint: false }).why, "no_title_spend");
  assert.equal(authorize({ ...good, title_is_canonical: false }).why, "no_title");
  assert.equal(authorize({ ...good, body_title: PACK }).why, "title_mismatch");
  assert.equal(authorize({ ...good, stale_outpoint: true }).why, "stale_outpoint");
});

test("build supersede / remove / seal", () => {
  const a = applyBuild(null, { content: { x: 1 }, remove: false, seal: false, seal_all: false });
  assert.deepEqual(a.state.content, { x: 1 });
  const b = applyBuild(a.state, { content: { x: 2 }, remove: false, seal: false, seal_all: false });
  assert.deepEqual(b.state.content, { x: 2 });
  const c = applyBuild(b.state, { remove: true, seal: true, seal_all: false });
  assert.equal(c.state.content, null);
  assert.equal(c.state.sealed, true);
  const d = applyBuild(c.state, { content: { x: 3 }, remove: false, seal: false, seal_all: false });
  assert.equal(d.ok, false);
});

test("T6/T7 commit-first: earlier commit wins; final is not displaced", () => {
  const early = { key: { height: 10, tx_index: 1, vout: 0 } };
  const lateReveal = { key: { height: 12, tx_index: 0, vout: 0 } };
  const betterCommit = { key: { height: 9, tx_index: 5, vout: 0 } };
  assert.equal(canTakeCell(early, lateReveal, 12), false);
  assert.equal(canTakeCell(early, betterCommit, 12), true);
  assert.equal(isFinal(10, 10 + WINDOW), false);
  assert.equal(isFinal(10, 10 + WINDOW + 1), true);
  assert.equal(canTakeCell(early, betterCommit, 10 + WINDOW + 1), false);
});

test("T7 atomic switch frees the old cell; failed take leaves it", () => {
  const parcelLive = { cell: "8c0000000000001", lastChange: 1, key: { height: 1, tx_index: 0, vout: 0 } };
  const taken = { parcel: 99, key: { height: 5, tx_index: 0, vout: 0 } };
  const fail = applyAnchor({
    cellOccupant: taken,
    parcelLive,
    op: { parcel: 1, h3_cell: CELL, clear: false },
    priority: { height: 20, tx_index: 0, vout: 0 },
    tip: 20,
    height: 1 + REANCHOR_COOLDOWN,
  });
  assert.equal(fail.why, "cell_taken");

  const ok = applyAnchor({
    cellOccupant: null,
    parcelLive,
    op: { parcel: 1, h3_cell: CELL, clear: false },
    priority: { height: 20, tx_index: 0, vout: 0 },
    tip: 20,
    height: 1 + REANCHOR_COOLDOWN,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.freed, "8c0000000000001");
  assert.equal(ok.parcelLive.cell, CELL);
});

test("cooldown blocks flicker re-anchors and first pin is free", () => {
  assert.equal(cooldownOk(null, 0), true);
  assert.equal(cooldownOk(10, 10 + REANCHOR_COOLDOWN - 1), false);
  assert.equal(cooldownOk(10, 10 + REANCHOR_COOLDOWN), true);
});
