import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { applyLog } from "./apply.mjs";
import { encodeCheckpoint, checkpointHash, deltaText, genesisRoot, nextRoot, recordLines, delta } from "./state.mjs";
import { buildAll } from "./make-vectors.mjs";
import { seedLatLng } from "./dmaps-geo.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const vec = JSON.parse(readFileSync(join(root, "vectors/indexer-state.json"), "utf8"));
const meta = { network: vec.network };

test("published vectors are exactly what the reference generates (run `npm run vectors`)", () => {
  for (const [rel, doc] of Object.entries(buildAll())) {
    // A Windows checkout may use CRLF; compare content, not line endings.
    const onDisk = readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");
    assert.equal(onDisk, JSON.stringify(doc, null, 2) + "\n", rel);
  }
});

test("state roots chain from the genesis root through each published delta", () => {
  let r = genesisRoot(meta);
  assert.equal(r, vec.genesis_root);
  for (const b of vec.blocks) {
    r = nextRoot(r, b.height, b.delta);
    assert.equal(r, b.state_root, `height ${b.height}`);
    if (b.delta.length) assert.equal(checkpointHash(deltaText(b.height, b.delta)), b.delta_text_sha256);
    else assert.equal(b.delta_text_sha256, null);
  }
});

test("replaying the log gives the published results, deltas, and snapshots", () => {
  const out = applyLog(vec.blocks, meta);
  out.blocks.forEach((b, i) => {
    const want = vec.blocks[i];
    assert.deepEqual(b.results.map((x) => (x.ok ? "ok" : x.ignored)), want.results, `results ${b.height}`);
    assert.deepEqual(b.entries, want.delta, `delta ${b.height}`);
    assert.equal(b.root, want.state_root, `root ${b.height}`);
    const text = encodeCheckpoint(b.state, { ...meta, height: b.height, root: b.root });
    assert.equal(checkpointHash(text), want.snapshot_hash, `snapshot ${b.height}`);
  });
  assert.equal(encodeCheckpoint(out.state, { ...meta, height: vec.blocks.at(-1).height, root: out.root }), vec.blocks.at(-1).snapshot);
});

test("reorg: dropping blocks and re-applying the rest returns to the earlier root", () => {
  for (let k = 1; k < vec.blocks.length; k++) {
    const out = applyLog(vec.blocks.slice(0, k), meta);
    assert.equal(out.root, vec.blocks[k - 1].state_root);
  }
});

test("a delta applied to the previous records yields the next records", () => {
  const out = applyLog(vec.blocks, meta);
  let prev = new Map();
  for (const b of out.blocks) {
    const next = new Map(prev);
    for (const e of b.entries) {
      if (e[0] === "-") next.delete(e.slice(1));
      else {
        const line = e.slice(1);
        const f = line.split(" ");
        const key = f[0] === "B" ? f.slice(0, 3).join(" ") : f.slice(0, 2).join(" ");
        next.set(key, line);
      }
    }
    assert.deepEqual(next, recordLines(b.state), `height ${b.height}`);
    assert.deepEqual(delta(prev, next), b.entries);
    prev = next;
  }
});

test("scenario covers the edge cases it claims to", () => {
  const all = vec.blocks.flatMap((b) => b.results);
  for (const why of ["duplicate", "dogemap_text", "media_type", "time_travel", "no_title", "no_title_spend", "not_vin0", "no_pack", "stale_outpoint", "unbound", "title_mismatch", "sealed", "already_anchored", "cell_taken", "not_anchored"]) {
    assert.ok(all.includes(why), why);
  }
  const quiet = vec.blocks.find((b) => b.height === 132);
  assert.deepEqual(quiet.delta, []);
  // Every record line is one of the four sections.
  for (const b of vec.blocks) for (const e of b.delta) assert.match(e, /^[+-][TPBC] /);
});

test("text and JSON spellings share one title slot", () => {
  const first = vec.blocks[0];
  assert.deepEqual(first.results.slice(0, 5), ["ok", "ok", "ok", "duplicate", "duplicate"]);
  assert.ok(first.delta.includes("+T 0 " + "a".repeat(64) + "i0"));
});

test("official geo seed is stable", () => {
  assert.equal(seedLatLng(0, 9).digest, "1e01c1e83ebfe7fa3c5cc0572e89f87fe249300179ebf6d3ac20f1748ea08efc");
});
