/** Apply an abstract block log to ÐMaps + ÐLand state. See vectors/indexer-state.json. */
import { districtOf, canTakeCell, cooldownOk, isFinal, WINDOW, REANCHOR_COOLDOWN } from "../protocols/dland/codec.mjs";

export function emptyState() {
  return { titles: {}, packs: {}, builds: {}, cells: {}, districts: {}, parcelLive: {} };
}

export function applyLog(blocks, start = emptyState()) {
  let state = structuredClone(start);
  const checkpoints = [];
  for (const block of blocks) {
    for (const ev of block.events) {
      applyEvent(state, ev, block.height, ev.tx_index ?? 0);
    }
    // finalize district badges at this tip
    for (const d of Object.values(state.districts)) {
      if (!d.final_ && isFinal(d.key.height, block.height)) d.final_ = true;
    }
    checkpoints.push({ height: block.height, state: structuredClone(state) });
  }
  return { state, checkpoints };
}

function applyEvent(state, ev, height, txIndex) {
  const typ = ev.type;
  if (typ === "maps_claim") {
    const h = ev.block_height;
    if (state.titles[h]) return { ignored: "duplicate" };
    if (ev.invalid) return { ignored: "invalid_claim" };
    state.titles[h] = ev.id;
    return { ok: true };
  }
  if (typ === "pack") {
    state.packs[ev.id] = { id: ev.id, name: ev.name, version: ev.version };
    return { ok: true };
  }
  if (typ === "transfer") {
    // abstract: mark current title outpoint generation
    state.parcelLive[ev.parcel] = state.parcelLive[ev.parcel] || {};
    state.parcelLive[ev.parcel].outpoint_gen = (state.parcelLive[ev.parcel].outpoint_gen || 0) + 1;
    return { ok: true };
  }
  if (typ === "build" || typ === "anchor") {
    if (!ev.committed) return { ignored: "unbound" };
    if (!ev.spends_title_outpoint) return { ignored: "no_title_spend" };
    if (ev.stale_outpoint) return { ignored: "stale_outpoint" };
    const title = state.titles[ev.parcel];
    if (!title) return { ignored: "no_title" };
    if (ev.title !== title) return { ignored: "title_mismatch" };
    if (typ === "build") return applyBuild(state, ev, height);
    return applyAnchor(state, ev, height, txIndex);
  }
  return { ignored: "unknown" };
}

function slotKey(parcel, pack) {
  return `${parcel}|${pack}`;
}

function applyBuild(state, ev, height) {
  if (!state.packs[ev.pack]) return { ignored: "no_pack" };
  const k = slotKey(ev.parcel, ev.pack);
  const prev = state.builds[k] || { parcel: ev.parcel, pack: ev.pack, content: null, sealed: false, applied: 0 };
  if (prev.sealed) return { ignored: "sealed" };
  const live = state.parcelLive[ev.parcel] || {};
  if (live.seal_all) return { ignored: "sealed" };
  if (ev.remove) prev.content = null;
  else if (ev.content !== undefined) prev.content = ev.content;
  if (ev.seal) prev.sealed = true;
  if (ev.seal_all) {
    state.parcelLive[ev.parcel] = { ...live, seal_all: true };
  }
  prev.applied += 1;
  prev.last_height = height;
  state.builds[k] = prev;
  return { ok: true };
}

function applyAnchor(state, ev, height, txIndex) {
  const live = state.parcelLive[ev.parcel] || {};
  if (!cooldownOk(live.lastChange, height)) return { ignored: "cooldown" };
  const key = ev.priority || { height, tx_index: txIndex, vout: 0 };
  const from_commit = ev.from_commit === true;
  if (ev.clear) {
    if (!live.cell) return { ignored: "not_anchored" };
    delete state.cells[live.cell];
    state.parcelLive[ev.parcel] = { ...live, cell: null, lastChange: height, key: null };
    return { ok: true };
  }
  const cell = ev.h3_cell;
  const occupant = state.cells[cell];
  if (occupant && occupant.parcel !== ev.parcel && !canTakeCell(occupant, { key }, height)) {
    return { ignored: "cell_taken" };
  }
  if (live.cell && live.cell !== cell) delete state.cells[live.cell];
  const district = ev.district || districtOf(cell);
  state.cells[cell] = {
    h3_cell: cell,
    parcel: ev.parcel,
    key,
    from_commit,
    anchor_id: ev.id,
    district,
  };
  state.parcelLive[ev.parcel] = { ...live, cell, lastChange: height, key };
  if (district && !state.districts[district]) {
    state.districts[district] = {
      district,
      founder_parcel: ev.parcel,
      anchor_id: ev.id,
      key,
      final_: isFinal(key.height, height),
    };
  }
  return { ok: true };
}

export { WINDOW, REANCHOR_COOLDOWN };
