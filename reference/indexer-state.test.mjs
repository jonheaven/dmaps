import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { applyLog } from "./apply.mjs";
import { encodeCheckpoint, checkpointHash } from "./checkpoint.mjs";
import { OFFICIAL_CELLS, seedLatLng } from "./dmaps-geo.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const vec = JSON.parse(readFileSync(join(here, "../vectors/indexer-state.json"), "utf8"));

test("indexer-state checkpoints match the published hashes", () => {
  const { checkpoints } = applyLog(vec.blocks);
  const meta = {
    network: vec.network,
    maps_activation: vec.maps_activation,
    land_activation: vec.land_activation,
  };
  assert.equal(checkpoints.length, vec.blocks.length);
  for (let i = 0; i < checkpoints.length; i++) {
    const text = encodeCheckpoint(checkpoints[i].state, { ...meta, height: vec.blocks[i].height });
    const hash = checkpointHash(text);
    assert.equal(hash, vec.blocks[i].checkpoint_hash, `height ${vec.blocks[i].height}`);
  }
  const last = checkpoints.at(-1).state;
  assert.equal(last.titles[0], vec.blocks.at(-1).expect.title_0);
  assert.equal(last.cells[vec.blocks.at(-1).expect.live_cell].parcel, 0);
  assert.equal(last.districts[vec.blocks.at(-1).expect.district].final_, false);
});

test("official geo seeds are stable (cells need h3-js 4.2.1 at verify time)", () => {
  const s0 = seedLatLng(0, 9);
  assert.equal(s0.digest, "1e01c1e83ebfe7fa3c5cc0572e89f87fe249300179ebf6d3ac20f1748ea08efc");
  assert.equal(OFFICIAL_CELLS[0].h3_cell, "89e98d184b7ffff");
});
