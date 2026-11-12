/** ÐLand reference codec: parse ops, H3 parent/resolution, priority, cooldown, standing inputs. */

export const MARKER = "Ð:LAND";
export const H3_ANCHOR_RES = 12;
export const H3_DISTRICT_RES = 7;
export const H3_REGION_RES = 4;
export const WINDOW = 30;
export const REANCHOR_COOLDOWN = 144;
export const MAX_PAYLOAD = 16 * 1024;
export const ID_RE = /^[0-9a-f]{64}i[0-9]+$/;

export function parse(body) {
  const text = typeof body === "string" ? body : new TextDecoder().decode(body);
  if (new TextEncoder().encode(text).length > MAX_PAYLOAD) return { ok: false, why: "too_large" };
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, why: "json" };
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, why: "not_object" };
  if (v.p !== MARKER) return { ok: false, why: "p" };
  if (v.v !== "1") return { ok: false, why: "v" };
  if (v.op === "pack") return parsePack(v);
  if (v.op === "build") return parseBuild(v);
  if (v.op === "anchor") return parseAnchor(v);
  return { ok: false, why: "op" };
}

function parsePack(v) {
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!name || [...name].length > 64) return { ok: false, why: "name" };
  const version = typeof v.version === "string" ? v.version : "";
  if (!version || version.length > 32 || /[^\x20-\x7e]/.test(version)) return { ok: false, why: "version" };
  const hasSchema = v.schema && typeof v.schema === "object" && !Array.isArray(v.schema);
  const uri = typeof v.schema_uri === "string" && v.schema_uri.length > 0;
  if (!hasSchema && !uri) return { ok: false, why: "schema" };
  if (v.note != null && (typeof v.note !== "string" || [...v.note].length > 500)) {
    return { ok: false, why: "note" };
  }
  if (v.supersedes != null && !ID_RE.test(v.supersedes)) return { ok: false, why: "supersedes" };
  return {
    ok: true,
    op: "pack",
    name,
    version,
    schema: hasSchema ? v.schema : undefined,
    schema_uri: uri ? v.schema_uri : undefined,
    note: v.note,
    supersedes: v.supersedes,
  };
}

function parseBuild(v) {
  if (!Number.isInteger(v.parcel) || v.parcel < 0) return { ok: false, why: "parcel" };
  if (!ID_RE.test(v.title)) return { ok: false, why: "title" };
  if (!ID_RE.test(v.pack)) return { ok: false, why: "pack" };
  const remove = v.remove === true;
  const seal = v.seal === true;
  const seal_all = v.seal_all === true;
  if (v.seal != null && typeof v.seal !== "boolean") return { ok: false, why: "seal" };
  if (v.seal_all != null && typeof v.seal_all !== "boolean") return { ok: false, why: "seal_all" };
  if (v.remove != null && typeof v.remove !== "boolean") return { ok: false, why: "remove" };
  if (remove) {
    if (v.content != null) return { ok: false, why: "content_on_remove" };
  } else if (v.content == null) {
    if (!seal && !seal_all) return { ok: false, why: "content" };
  } else if (typeof v.content !== "object" || Array.isArray(v.content)) {
    return { ok: false, why: "content" };
  }
  return {
    ok: true,
    op: "build",
    parcel: v.parcel,
    title: v.title,
    pack: v.pack,
    content: remove ? undefined : v.content ?? {},
    remove,
    seal,
    seal_all,
  };
}

function parseAnchor(v) {
  if (!Number.isInteger(v.parcel) || v.parcel < 0) return { ok: false, why: "parcel" };
  if (!ID_RE.test(v.title)) return { ok: false, why: "title" };
  const clear = v.clear === true;
  if (v.clear != null && typeof v.clear !== "boolean") return { ok: false, why: "clear" };
  if (clear) {
    if (v.h3_cell != null) return { ok: false, why: "cell_on_clear" };
    return { ok: true, op: "anchor", parcel: v.parcel, title: v.title, clear: true };
  }
  if (v.h3_res != null && v.h3_res !== H3_ANCHOR_RES) return { ok: false, why: "h3_res" };
  const cell = parseH3Cell(v.h3_cell, H3_ANCHOR_RES);
  if (!cell) return { ok: false, why: "h3_cell" };
  if (v.place != null && !ID_RE.test(v.place)) return { ok: false, why: "place" };
  return {
    ok: true,
    op: "anchor",
    parcel: v.parcel,
    title: v.title,
    h3_res: H3_ANCHOR_RES,
    h3_cell: cell,
    place: v.place,
    clear: false,
  };
}

/** Parse a canonical H3 cell string; require mode=1 and exact resolution. */
export function parseH3Cell(s, expectRes) {
  if (typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  if (!t || t.length > 16 || !/^[0-9a-f]+$/.test(t)) return null;
  let idx;
  try {
    idx = BigInt("0x" + t);
  } catch {
    return null;
  }
  if (t !== idx.toString(16)) return null; // canonical: no leading zeros
  const mode = Number((idx >> 59n) & 0xfn);
  const res = Number((idx >> 52n) & 0xfn);
  if (mode !== 1) return null;
  if (expectRes != null && res !== expectRes) return null;
  return t;
}

export function h3Index(s) {
  const t = parseH3Cell(s);
  if (!t) return null;
  return BigInt("0x" + t);
}

export function h3Resolution(s) {
  const idx = h3Index(s);
  if (idx == null) return null;
  return Number((idx >> 52n) & 0xfn);
}

/** H3 v4 cellToParent (set res, fill finer digits with unused=7). */
export function h3Parent(s, parentRes) {
  const idx0 = h3Index(s);
  if (idx0 == null) return null;
  const res = Number((idx0 >> 52n) & 0xfn);
  if (parentRes < 0 || parentRes > res) return null;
  let idx = idx0;
  idx = (idx & ~(0xfn << 52n)) | (BigInt(parentRes) << 52n);
  for (let d = parentRes + 1; d <= 15; d++) {
    const shift = BigInt(44 - (d - 1) * 3);
    idx = (idx & ~(0x7n << shift)) | (0x7n << shift);
  }
  return idx.toString(16);
}

export function districtOf(cell) {
  return h3Parent(cell, H3_DISTRICT_RES);
}

export function regionOf(cell) {
  return h3Parent(cell, H3_REGION_RES);
}

/** Lower key wins. Keys are {height, tx_index, vout}. */
export function priorityCmp(a, b) {
  if (a.height !== b.height) return a.height - b.height;
  if (a.tx_index !== b.tx_index) return a.tx_index - b.tx_index;
  return a.vout - b.vout;
}

export function isFinal(priorityHeight, tip) {
  return tip > priorityHeight + WINDOW;
}

/** Can `incoming` take a cell occupied by `existing` at `tip`? */
export function canTakeCell(existing, incoming, tip) {
  if (!existing) return true;
  if (isFinal(existing.key.height, tip)) return false;
  return priorityCmp(incoming.key, existing.key) < 0;
}

export function cooldownOk(lastChange, height) {
  if (lastChange == null) return true;
  return height >= lastChange + REANCHOR_COOLDOWN;
}

/** Authorization facts a chain indexer supplies; this codec only checks the boolean policy. */
export function authorize(facts) {
  if (!facts.committed) return { ok: false, why: "unbound" };
  if (!facts.spends_title_outpoint) return { ok: false, why: "no_title_spend" };
  if (!facts.title_is_canonical) return { ok: false, why: "no_title" };
  if (facts.body_title !== facts.canonical_title) return { ok: false, why: "title_mismatch" };
  if (facts.stale_outpoint) return { ok: false, why: "stale_outpoint" };
  return { ok: true };
}

/** Apply a build to a slot. prev: {content, sealed} or empty. */
export function applyBuild(prev, op) {
  const state = prev ?? { content: null, sealed: false, seal_all: false, applied: 0 };
  if (state.sealed || state.seal_all) return { ok: false, why: "sealed" };
  const next = { ...state, applied: state.applied + 1 };
  if (op.remove) next.content = null;
  else if (op.content !== undefined) next.content = op.content;
  if (op.seal) next.sealed = true;
  if (op.seal_all) next.seal_all = true;
  return { ok: true, state: next };
}

/**
 * Apply an anchor for one parcel/cell market.
 * cellOccupant: {parcel, key} or null
 * parcelLive: {cell, lastChange, key} or null
 */
export function applyAnchor({ cellOccupant, parcelLive, op, priority, tip, height }) {
  if (!cooldownOk(parcelLive?.lastChange, height)) return { ok: false, why: "cooldown" };
  if (op.clear) {
    if (!parcelLive?.cell) return { ok: false, why: "not_anchored" };
    return { ok: true, freed: parcelLive.cell, parcelLive: null, occupied: null };
  }
  if (!canTakeCell(cellOccupant && cellOccupant.parcel !== op.parcel ? cellOccupant : null, { key: priority }, tip)
      && !(cellOccupant && cellOccupant.parcel === op.parcel)) {
    // same parcel re-anchoring onto its own cell is a no-op change of metadata; still cooldown-bound
    return { ok: false, why: "cell_taken" };
  }
  // If same parcel already occupies this cell, just refresh? treat as no cell switch — cooldown still applies
  const freed = parcelLive?.cell && parcelLive.cell !== op.h3_cell ? parcelLive.cell : null;
  return {
    ok: true,
    freed,
    parcelLive: { cell: op.h3_cell, lastChange: height, key: priority },
    occupied: { parcel: op.parcel, key: priority },
  };
}
