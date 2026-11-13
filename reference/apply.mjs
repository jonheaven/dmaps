/**
 * Reference ÐMaps + ÐLand state machine over an abstract block log (vectors/indexer-state.json).
 * A claim event carries the inscription's body and content type and is parsed here; a ÐLand
 * event already passed parsing and carries the chain facts an indexer reads from the
 * transaction (committed, title spend, priority key). Normative text: docs/INDEXING.md §4–§7.
 *
 * There is no end-of-block step: every rule is decided by the op that triggers it.
 */
import { canTakeCell, authorize, WINDOW } from "../protocols/dland/codec.mjs";
import { parseClaim } from "./dmaps-claim.mjs";
import { recordLines, delta, nextRoot, genesisRoot } from "./state.mjs";

/** `pins` (parcel -> cell) is an index, not a record: it is the inverse of `cells`. */
export function emptyState() {
  return { titles: {}, packs: {}, builds: {}, cells: {}, pins: {} };
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
    for (const ev of block.events) results.push(applyEvent(state, ev, block.height));
    const entries = delta(before, recordLines(state));
    root = nextRoot(root, block.height, entries);
    out.push({ height: block.height, state: structuredClone(state), entries, root, results });
  }
  return { state, blocks: out, root };
}

export function applyEvent(state, ev, height) {
  switch (ev.type) {
    case "maps_claim": {
      const c = parseClaim(ev.body, ev.content_type ?? null, height);
      if (!c.ok) return { ignored: c.why };
      if (state.titles[c.block_height] !== undefined) return { ignored: "duplicate" };
      state.titles[c.block_height] = ev.id;
      return { ok: true };
    }
    case "pack":
      // A pack id is an inscription id, so it is written once.
      if (!state.packs[ev.id]) state.packs[ev.id] = { id: ev.id, name: ev.name, version: ev.version, height };
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

function applyBuild(state, ev, height) {
  if (!state.packs[ev.pack]) return { ignored: "no_pack" };
  const k = slotKey(ev.parcel, ev.pack);
  const slot = state.builds[k] ?? { parcel: ev.parcel, pack: ev.pack, content: null, sealed: false, applied: 0 };
  if (slot.sealed) return { ignored: "sealed" };
  if (ev.remove) slot.content = null;
  else if (ev.content !== undefined) slot.content = ev.content; // seal without content keeps live content
  if (ev.seal) slot.sealed = true;
  slot.applied += 1; // informative (standing), not part of the record line
  slot.last_height = height;
  slot.last_build = ev.id;
  state.builds[k] = slot;
  return { ok: true };
}

function release(state, parcel) {
  const cell = state.pins[parcel];
  if (cell) {
    delete state.cells[cell];
    delete state.pins[parcel];
  }
}

function applyAnchor(state, ev, height) {
  const mine = state.pins[ev.parcel] ?? null;
  if (ev.clear) {
    if (!mine) return { ignored: "not_anchored" };
    release(state, ev.parcel);
    return { ok: true };
  }
  const cell = ev.h3_cell;
  if (mine === cell) return { ignored: "already_anchored" };
  const key = ev.priority ?? { height, tx_index: ev.tx_index ?? 0, vout: 0 };
  const occupant = state.cells[cell];
  let displaced = null;
  if (occupant) {
    if (!canTakeCell(occupant, { key }, height)) return { ignored: "cell_taken" };
    // Commit-first: a strictly earlier commit displaces a pending occupant, which is unpinned.
    displaced = occupant.parcel;
    release(state, displaced);
  }
  release(state, ev.parcel);
  state.cells[cell] = { h3_cell: cell, parcel: ev.parcel, key, anchor_id: ev.id };
  state.pins[ev.parcel] = cell;
  return displaced === null ? { ok: true } : { ok: true, displaced };
}

export { WINDOW };
