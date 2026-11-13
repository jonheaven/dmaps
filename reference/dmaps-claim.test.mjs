import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseClaim, dogemapsCell, mediaTypeOk } from "./dmaps-claim.mjs";
import { OFFICIAL_CELLS } from "./dmaps-geo.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const conf = JSON.parse(readFileSync(join(here, "../protocols/dogemaps/vectors/conformance.json"), "utf8"));

test("claim vectors", () => {
  assert.ok(conf.claims.length >= 30);
  for (const c of conf.claims) {
    const r = parseClaim(c.body, c.content_type, c.height);
    assert.equal(r.ok ? "pass" : "fail", c.expect, `${c.id}: ${c.description} (${r.why})`);
    if (c.expect === "fail") assert.equal(r.why, c.why, c.id);
    else {
      assert.equal(r.block_height, c.block_height, c.id);
      assert.equal(r.form, c.form, c.id);
    }
  }
});

test("both spellings name the same title", () => {
  const a = parseClaim("42.dogemap", "text/plain", 42);
  const b = parseClaim(JSON.stringify({ p: "Ð:MAPS", op: "claim", title: { block_height: 42 } }), "application/json", 42);
  assert.equal(a.block_height, 42);
  assert.equal(b.block_height, 42);
  assert.equal(parseClaim(new TextEncoder().encode("42.dogemap"), "text/plain", 41).why, "time_travel");
});

test("media types", () => {
  assert.equal(mediaTypeOk("text/plain"), true);
  assert.equal(mediaTypeOk("text/plain;charset=utf-8"), true);
  assert.equal(mediaTypeOk("application/json"), true);
  assert.equal(mediaTypeOk("text/html"), false);
  assert.equal(mediaTypeOk(null), false);
});

test("derived cells (h3-js 4.2.1)", () => {
  for (const c of OFFICIAL_CELLS) assert.equal(dogemapsCell(c.block_height, c.h3_res), c.h3_cell);
  for (const v of conf.vectors.filter((x) => x.expect === "cell")) assert.equal(dogemapsCell(v.block_height, v.h3_res), v.h3_cell);
  conf.geo_batch.forEach((cell, h) => assert.equal(dogemapsCell(h, 9), cell, String(h)));
});
