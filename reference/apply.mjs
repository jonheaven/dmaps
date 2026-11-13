/**
 * Reference ÐMaps + ÐLand state machine over an abstract block log (vectors/indexer-state.json).
 * Each event is a confirmed inscription that already passed parsing; the event carries the
 * chain facts an indexer reads from the transaction (committed, title spend, priority key).
 * Normative text: docs/INDEXING.md §4–§7.
 */
import {
  districtOf,
  canTakeCell,
  cooldownOk,
  isFinal,
  priorityCmp,
  authorize,
  WINDOW,
  REANCHOR_COOLDOWN,
} from "../protocols/dland/codec.mjs";
import { recordLines, delta, nextRoot, genesisRoot } from "./state.mjs";

export function emptyState() {
  return { titles: {}, packs: {}, builds: {}, live: {}, cells: {}, districts: {} };
}

/**
 * Apply blocks in order. Returns the final state and, per block, the state, the delta
 * entries, and the state root after the block.
 */
export function applyLog(blocks, meta, start = emptyState()) {
  const state = structuredClone(start);
  let root = genesisRoot(meta);
  const out = [];
  for (const block of blocks) {
    const before = recordLines(state);
    const results = [];
    for (const ev of block.events) {
      results.push(applyEvent(state, ev, block.height));
    }
    endBlock(state, block.height);
    const entries = delta(before, recordLines(state));
    root = nextRoot(root, block.height, entries);
    out.push({ height: block.height, state: structuredClone(state), entries, root, results });
  }
  return { state, blocks: out, root };
}

export function applyEvent(state, ev, height) {
  switch (ev.type) {
    case "maps_claim": {
      if (ev.invalid) return { ignored: "invalid_claim" };
      if (state.titles[ev.block_height] !== undefined) return { ignored: "duplicate" };
      state.titles[ev.block_height] = ev.id;
      return { ok: true };
    }
    case "pack":
      state.packs[ev.id] = { id: ev.id, name: ev.name, version: ev.version, height };
      return { ok: true };
    case "transfer":
      // Moving the title UTXO changes who can spend it, not any protocol state.
      return { ok: true };
    case "build":
    case "anchor": {
      const canonical = state.titles[ev.parcel];
      const auth = authorize({
        committed: ev.committed === true,
        op_index: ev.op_index ?? 0,
        spends_title_outpoint: ev.spends_title_outpoint === true,
        title_is_canonical: canonical !== undefined,
        body_title: ev.title,
        canonical_title: canonical,
        title_in_same_tx: ev.title_in_same_tx === true,
        stale_outpoint: ev.stale_outpoint === true,
      });
      if (!auth.ok) return { ignored: auth.why };
      return ev.type === "build" ? applyBuild(state, ev, height) : applyAnchor(state, ev, height);
    }
    default:
      return { ignored: "unknown" };
  }
}

const slotKey = (parcel, pack) => `${parcel}|${pack}`;
const liveOf = (state, parcel) => state.live[parcel] ?? { cell: null, last_change: null, seal_all: false };

function applyBuild(state, ev, height) {
  if (!state.packs[ev.pack]) return { ignored: "no_pack" };
  const k = slotKey(ev.parcel, ev.pack);
  const slot = state.builds[k] ?? { parcel: ev.parcel, pack: ev.pack, content: null, sealed: false, applied: 0 };
  if (slot.sealed) return { ignored: "sealed" };
  const live = liveOf(state, ev.parcel);
  if (live.seal_all) return { ignored: "sealed" };
  if (ev.remove) slot.content = null;
  else if (ev.content !== undefined) slot.content = ev.content; // omitted content (seal only) keeps live content
  if (ev.seal) slot.sealed = true;
  if (ev.seal_all) state.live[ev.parcel] = { ...live, seal_all: true };
  slot.applied += 1;
  slot.last_height = height;
  slot.last_build = ev.id;
  state.builds[k] = slot;
  return { ok: true };
}

function applyAnchor(state, ev, height) {
  const live = liveOf(state, ev.parcel);
  if (!cooldownOk(live.last_change, height)) return { ignored: "cooldown" };
  if (ev.clear) {
    if (!live.cell) return { ignored: "not_anchored" };
    delete state.cells[live.cell];
    state.live[ev.parcel] = { ...live, cell: null, last_change: height };
    return { ok: true };
  }
  const cell = ev.h3_cell;
  if (live.cell === cell) return { ignored: "already_anchored" };
  const key = ev.priority ?? { height, tx_index: ev.tx_index ?? 0, vout: 0 };
  const occupant = state.cells[cell];
  let displaced = null;
  if (occupant) {
    if (!canTakeCell(occupant, { key }, height)) return { ignored: "cell_taken" };
    // A strictly earlier commit displaces a pending occupant; the loser is unanchored.
    displaced = occupant.parcel;
    state.live[displaced] = { ...liveOf(state, displaced), cell: null };
  }
  if (live.cell) delete state.cells[live.cell];
  state.cells[cell] = {
    h3_cell: cell,
    parcel: ev.parcel,
    key,
    from_commit: ev.from_commit === true,
    anchor_id: ev.id,
  };
  state.live[ev.parcel] = { ...live, cell, last_change: height };
  return displaced === null ? { ok: true } : { ok: true, displaced };
}

/**
 * End of block `tip`: for every district whose founder is not final, the founder is the live
 * occupant with the lowest priority key (none if the district is empty). It becomes final,
 * and permanent, once that key is final at `tip`.
 */
export function endBlock(state, tip) {
  const byDistrict = {};
  for (const c of Object.values(state.cells)) {
    const d = districtOf(c.h3_cell);
    if (!byDistrict[d] || priorityCmp(c.key, byDistrict[d].key) < 0) byDistrict[d] = c;
  }
  const names = new Set([...Object.keys(byDistrict), ...Object.keys(state.districts)]);
  for (const d of names) {
    const cur = state.districts[d];
    if (cur && cur.final_) continue;
    const low = byDistrict[d];
    if (!low) {
      delete state.districts[d];
      continue;
    }
    state.districts[d] = {
      district: d,
      founder_parcel: low.parcel,
      anchor_id: low.anchor_id,
      key: low.key,
      final_: isFinal(low.key.height, tip),
    };
  }
}

export { WINDOW, REANCHOR_COOLDOWN };
