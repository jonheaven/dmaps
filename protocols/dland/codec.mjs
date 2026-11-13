/**
 * ÐLand reference codec: parse ops under the dmaps JSON profile, H3 checks (h3-js 4.2.1),
 * priority, cooldown, and the authorization policy. Normative text: spec.md and
 * ../../docs/INDEXING.md. Dogex (Rust) implements the same rules independently.
 */
import { isValidCell, getResolution, cellToParent } from "h3-js";
import { parseBody, isInscriptionId, isU32, has, codePoints } from "../../reference/json-profile.mjs";

export const MARKER = "Ð:LAND";
export const H3_ANCHOR_RES = 12;
export const H3_DISTRICT_RES = 7;
export const H3_REGION_RES = 4;
export const WINDOW = 30;
export const REANCHOR_COOLDOWN = 144;
export const MAX_PAYLOAD = 16 * 1024;
export const MAX_SCHEMA_URI = 512;

const isBool = (v) => typeof v === "boolean";
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Parse a ÐLand body (bytes or string). Returns { ok:true, op, ... } or { ok:false, why }. */
export function parse(body) {
  const r = parseBody(body, MAX_PAYLOAD);
  if (!r.ok) return r;
  const v = r.value;
  if (v.p !== MARKER) return { ok: false, why: "p" };
  if (v.v !== "1") return { ok: false, why: "v" };
  if (v.op === "pack") return parsePack(v);
  if (v.op === "build") return parseBuild(v);
  if (v.op === "anchor") return parseAnchor(v);
  return { ok: false, why: "op" };
}

function parsePack(v) {
  const name = v.name;
  if (typeof name !== "string" || name.length === 0 || codePoints(name) > 64) return { ok: false, why: "name" };
  const version = v.version;
  if (typeof version !== "string" || version.length === 0 || version.length > 32 || /[^\x20-\x7e]/.test(version)) {
    return { ok: false, why: "version" };
  }
  if (has(v, "schema") && !isObj(v.schema)) return { ok: false, why: "schema" };
  if (has(v, "schema_uri")) {
    const u = v.schema_uri;
    if (typeof u !== "string" || u.length === 0 || codePoints(u) > MAX_SCHEMA_URI) return { ok: false, why: "schema_uri" };
  }
  if (!has(v, "schema") && !has(v, "schema_uri")) return { ok: false, why: "schema" };
  if (has(v, "note") && (typeof v.note !== "string" || codePoints(v.note) > 500)) return { ok: false, why: "note" };
  if (has(v, "supersedes") && !isInscriptionId(v.supersedes)) return { ok: false, why: "supersedes" };
  return {
    ok: true,
    op: "pack",
    name,
    version,
    schema: v.schema,
    schema_uri: v.schema_uri,
    note: v.note,
    supersedes: v.supersedes,
  };
}

function parseParcelTitle(v) {
  if (!isU32(v.parcel)) return { ok: false, why: "parcel" };
  if (!isInscriptionId(v.title)) return { ok: false, why: "title" };
  return null;
}

function parseBuild(v) {
  const bad = parseParcelTitle(v);
  if (bad) return bad;
  if (!isInscriptionId(v.pack)) return { ok: false, why: "pack" };
  for (const k of ["remove", "seal", "seal_all"]) {
    if (has(v, k) && !isBool(v[k])) return { ok: false, why: k };
  }
  const remove = v.remove === true;
  const seal = v.seal === true;
  const seal_all = v.seal_all === true;
  const hasContent = has(v, "content");
  if (hasContent && !isObj(v.content)) return { ok: false, why: "content" };
  if (remove && hasContent) return { ok: false, why: "content_on_remove" };
  if (!remove && !hasContent && !seal && !seal_all) return { ok: false, why: "content" };
  return {
    ok: true,
    op: "build",
    parcel: v.parcel,
    title: v.title,
    pack: v.pack,
    // undefined = leave live content as it is (seal / seal_all without new content)
    content: hasContent ? v.content : undefined,
    remove,
    seal,
    seal_all,
  };
}

function parseAnchor(v) {
  const bad = parseParcelTitle(v);
  if (bad) return bad;
  if (has(v, "clear") && !isBool(v.clear)) return { ok: false, why: "clear" };
  if (has(v, "place") && !isInscriptionId(v.place)) return { ok: false, why: "place" };
  if (v.clear === true) {
    if (has(v, "h3_cell") || has(v, "h3_res")) return { ok: false, why: "cell_on_clear" };
    return { ok: true, op: "anchor", parcel: v.parcel, title: v.title, clear: true };
  }
  if (v.h3_res !== H3_ANCHOR_RES) return { ok: false, why: "h3_res" };
  if (!isCell(v.h3_cell, H3_ANCHOR_RES)) return { ok: false, why: "h3_cell" };
  return {
    ok: true,
    op: "anchor",
    parcel: v.parcel,
    title: v.title,
    h3_res: H3_ANCHOR_RES,
    h3_cell: v.h3_cell,
    place: v.place,
    clear: false,
  };
}

/**
 * Canonical H3 v4 cell string at `res`: lowercase hex exactly as h3-js `cellToString`
 * prints it (15 digits, no `0x`, no leading zeros) and `isValidCell` true.
 */
export function isCell(s, res) {
  if (typeof s !== "string" || !/^8[0-9a-f]{14}$/.test(s)) return false;
  if (!isValidCell(s)) return false;
  return res == null || getResolution(s) === res;
}

export function h3Resolution(s) {
  return isCell(s) ? getResolution(s) : null;
}

/** H3 v4 cellToParent. */
export function h3Parent(s, parentRes) {
  if (!isCell(s)) return null;
  if (parentRes < 0 || parentRes > getResolution(s)) return null;
  return cellToParent(s, parentRes);
}

export const districtOf = (cell) => h3Parent(cell, H3_DISTRICT_RES);
export const regionOf = (cell) => h3Parent(cell, H3_REGION_RES);

/** Lower key wins. Keys are {height, tx_index, vout}. */
export function priorityCmp(a, b) {
  if (a.height !== b.height) return a.height - b.height;
  if (a.tx_index !== b.tx_index) return a.tx_index - b.tx_index;
  return a.vout - b.vout;
}

export function isFinal(priorityHeight, tip) {
  return tip > priorityHeight + WINDOW;
}

/** Can `incoming` take a cell occupied by `existing` (another parcel) at `tip`? */
export function canTakeCell(existing, incoming, tip) {
  if (!existing) return true;
  if (isFinal(existing.key.height, tip)) return false;
  return priorityCmp(incoming.key, existing.key) < 0;
}

export function cooldownOk(lastChange, height) {
  if (lastChange == null) return true;
  return height >= lastChange + REANCHOR_COOLDOWN;
}

/**
 * Authorization policy over facts a chain indexer supplies (docs/INDEXING.md §5.2).
 * facts: committed, op_index, spends_title_outpoint, title_is_canonical, body_title,
 * canonical_title, title_in_same_tx, stale_outpoint.
 */
export function authorize(facts) {
  if (!facts.committed) return { ok: false, why: "unbound" };
  if ((facts.op_index ?? 0) !== 0) return { ok: false, why: "not_vin0" };
  if (!facts.title_is_canonical) return { ok: false, why: "no_title" };
  if (facts.body_title !== facts.canonical_title) return { ok: false, why: "title_mismatch" };
  if (facts.title_in_same_tx) return { ok: false, why: "no_title_spend" };
  if (!facts.spends_title_outpoint) return { ok: false, why: "no_title_spend" };
  if (facts.stale_outpoint) return { ok: false, why: "stale_outpoint" };
  return { ok: true };
}
