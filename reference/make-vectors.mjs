/**
 * Regenerates the published vectors from the reference implementation:
 *   vectors/indexer-state.json, protocols/dland/vectors/conformance.json,
 *   protocols/dogemaps/vectors/conformance.json.
 * `npm test` checks the committed files against the reference, so a rule change that is not
 * reflected in the vectors fails CI. Run `npm run vectors` after an intentional change and
 * review the diff: every changed hash is a consensus change.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cellToParent, latLngToCell, isValidCell } from "h3-js";
import { applyLog } from "./apply.mjs";
import { encodeCheckpoint, checkpointHash, deltaText, genesisRoot, STATE_VERSION, CHECKPOINT_VERSION } from "./state.mjs";
import { parse, authorize, canTakeCell, isCell, H3_ANCHOR_RES, H3_DISTRICT_RES, H3_REGION_RES, WINDOW } from "../protocols/dland/codec.mjs";
import { parseClaim, dogemapsCell } from "./dmaps-claim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const id = (c, n = 0) => c.repeat(64) + "i" + n;

// ---------------------------------------------------------------------------
// Indexer-state scenario
// ---------------------------------------------------------------------------

export const CELL_A = "8c28308280f37ff"; // district 872830828ffffff
export const CELL_A2 = "8c28308280f35ff"; // neighbor of A, same district
export const CELL_B = latLngToCell(-33.8568, 151.2153, 12); // Sydney, another district

const T0 = id("a"), T1 = id("d"), T2 = id("9");
const P = id("b"), Q = id("f"), R = id("8");
const holder = { committed: true, spends_title_outpoint: true };

const TXT = "text/plain;charset=utf-8";
const JSN = "application/json";
const claimJson = (bh, extra = {}) => JSON.stringify({ p: "Ð:MAPS", op: "claim", title: { block_height: bh }, ...extra });

export const SCENARIO = {
  spec: STATE_VERSION,
  checkpoint: CHECKPOINT_VERSION,
  h3: "4.2.1",
  network: "regtest",
  description:
    "Worked indexer log. A maps_claim event is an inscription (body, content type) whose body is complete in that block; " +
    "the other events are an abstract encoding of confirmed ÐLand inscriptions that already passed parsing, each with " +
    "the chain facts an indexer reads from the transaction. Events are in canonical order. A conformant indexer MUST " +
    "produce the listed results, delta and state_root after every height, and the listed snapshot_hash. Blocks with " +
    "no delta leave the root unchanged.",
  blocks: [
    { height: 100, events: [
      { type: "maps_claim", id: T0, body: "0.dogemap", content_type: TXT, comment: "the existing text convention" },
      { type: "maps_claim", id: T1, body: claimJson(1, { v: "1", chain: "dogecoin", geo: { h3_res: 9, h3_cell: "8928308280fffff" }, fair: { stake_koinu: "1", stake_burn: true } }), content_type: JSN, comment: "a 0.1-era JSON claim: only p, op and title.block_height are read" },
      { type: "maps_claim", id: T2, body: claimJson(2), content_type: TXT },
      { type: "maps_claim", id: id("e"), body: "0.dogemap", content_type: TXT, comment: "duplicate: the first claim already won" },
      { type: "maps_claim", id: id("e", 1), body: claimJson(0), content_type: JSN, comment: "duplicate in the other spelling" },
      { type: "maps_claim", id: id("7"), body: "03.dogemap", content_type: TXT, comment: "leading zero" },
      { type: "maps_claim", id: id("7", 1), body: " 3.dogemap", content_type: TXT, comment: "no trimming" },
      { type: "maps_claim", id: id("7", 2), body: "3.dogemap", content_type: "image/png", comment: "not a text or JSON inscription" },
      { type: "maps_claim", id: id("7", 3), body: "101.dogemap", content_type: TXT, comment: "block 101 does not exist yet" },
    ] },
    { height: 101, events: [
      { type: "pack", id: P, name: "street-scene", version: "1.0.0" },
      { type: "pack", id: Q, name: 'Ð shop "sign"', version: "2.0.0-beta" },
      { type: "pack", id: R, name: "lore", version: "1" },
      { type: "maps_claim", id: id("6", 9), body: "101.dogemap", content_type: TXT, comment: "a block may be claimed in itself" },
    ] },
    { height: 102, events: [
      { type: "build", parcel: 0, title: T0, pack: P, id: id("1"), ...holder, content: { model: "ipfs://z" }, tx_index: 1 },
      { type: "build", parcel: 0, title: T0, pack: P, id: id("2"), committed: true, spends_title_outpoint: false, content: { model: "hacked" }, tx_index: 2, comment: "T1 non-holder" },
      { type: "build", parcel: 0, title: T0, pack: P, id: id("2", 1), ...holder, op_index: 1, content: { model: "hacked" }, tx_index: 3, comment: "not the vin[0] inscription" },
      { type: "build", parcel: 0, title: T0, pack: id("c"), id: id("4"), ...holder, content: { x: 1 }, tx_index: 4, comment: "unknown pack" },
      { type: "build", parcel: 3, title: id("7", 2), pack: P, id: id("4", 1), ...holder, content: { x: 1 }, tx_index: 5, comment: "parcel 3 has no title" },
    ] },
    { height: 103, events: [
      { type: "transfer", parcel: 0, title: T0, tx_index: 1 },
      { type: "build", parcel: 0, title: T0, pack: P, id: id("3"), ...holder, stale_outpoint: true, content: { model: "stale" }, tx_index: 2, comment: "T2 stale holder" },
      { type: "build", parcel: 0, title: T0, pack: P, id: id("5"), ...holder, title_in_same_tx: true, content: { model: "same-tx" }, tx_index: 3, comment: "title did not exist at the start of the tx" },
      { type: "build", parcel: 0, title: T0, pack: P, id: id("6"), committed: false, spends_title_outpoint: true, content: { model: "unbound" }, tx_index: 4, comment: "T4 unbound" },
      { type: "build", parcel: 0, title: T1, pack: P, id: id("6", 1), ...holder, content: { model: "mismatch" }, tx_index: 5, comment: "T5 body names another title" },
    ] },
    { height: 104, events: [
      { type: "anchor", parcel: 0, title: T0, id: id("c", 0), h3_cell: CELL_A, ...holder, priority: { height: 103, tx_index: 0, vout: 0 }, tx_index: 1 },
    ] },
    { height: 105, events: [
      { type: "anchor", parcel: 1, title: T1, id: id("c", 1), h3_cell: CELL_A2, ...holder, priority: { height: 104, tx_index: 2, vout: 0 }, tx_index: 1 },
    ] },
    { height: 106, events: [
      { type: "anchor", parcel: 1, title: T1, id: id("c", 2), h3_cell: CELL_B, ...holder, tx_index: 1, comment: "move: no cooldown; A2 is released" },
      { type: "build", parcel: 0, title: T0, pack: Q, id: id("1", 1), ...holder, content: { sign: "hi", n: [1, -2, 3] }, seal: true, tx_index: 2 },
    ] },
    { height: 107, events: [
      { type: "build", parcel: 0, title: T0, pack: P, id: id("1", 2), ...holder, seal: true, tx_index: 1, comment: "seal without content keeps the live content" },
      { type: "build", parcel: 0, title: T0, pack: P, id: id("1", 3), ...holder, content: { model: "late" }, tx_index: 2, comment: "slot sealed" },
    ] },
    { height: 108, events: [
      { type: "anchor", parcel: 2, title: T2, id: id("c", 3), h3_cell: CELL_A, ...holder, priority: { height: 102, tx_index: 5, vout: 1 }, tx_index: 1, comment: "earlier commit displaces parcel 0 (pending); parcel 0 is unpinned" },
      { type: "anchor", parcel: 0, title: T0, id: id("c", 4), h3_cell: CELL_A, ...holder, priority: { height: 103, tx_index: 0, vout: 0 }, tx_index: 2, comment: "the loser cannot take it back with its later key" },
    ] },
    { height: 109, events: [
      { type: "anchor", parcel: 0, title: T0, id: id("c", 5), h3_cell: CELL_A2, ...holder, tx_index: 1, comment: "free cell (parcel 1 left it)" },
    ] },
    { height: 132, events: [], comment: "no delta: root unchanged" },
    { height: 140, events: [
      { type: "anchor", parcel: 101, title: id("6", 9), id: id("c", 6), h3_cell: CELL_A, ...holder, priority: { height: 1, tx_index: 0, vout: 0 }, tx_index: 1, comment: "final occupant (key 102, tip 140 > 132): even a lower key cannot take it" },
      { type: "anchor", parcel: 101, title: id("6", 9), id: id("c", 7), clear: true, ...holder, tx_index: 2, comment: "nothing to clear" },
    ] },
    { height: 250, events: [
      { type: "anchor", parcel: 0, title: T0, id: id("c", 8), h3_cell: CELL_A2, ...holder, tx_index: 1, comment: "already on this cell: nothing changes" },
      { type: "anchor", parcel: 1, title: T1, id: id("c", 9), clear: true, ...holder, tx_index: 2, comment: "clear releases CELL_B" },
      { type: "anchor", parcel: 101, title: id("6", 9), id: id("d", 1), h3_cell: CELL_B, ...holder, tx_index: 3, comment: "no commit in the window: the key is the reveal position" },
      { type: "build", parcel: 0, title: T0, pack: R, id: id("1", 4), ...holder, content: { chapter: 1 }, seal_all: true, tx_index: 4, comment: "seal_all is not a field (ignored)" },
    ] },
    { height: 251, events: [
      { type: "build", parcel: 0, title: T0, pack: R, id: id("1", 5), ...holder, content: { chapter: 2 }, tx_index: 1, comment: "supersede" },
      { type: "build", parcel: 1, title: T1, pack: P, id: id("1", 6), ...holder, content: { a: [1, 2], "é": "ü" }, tx_index: 2 },
    ] },
    { height: 252, events: [
      { type: "build", parcel: 1, title: T1, pack: P, id: id("1", 7), ...holder, remove: true, tx_index: 1, comment: "remove: an unsealed empty slot has no record" },
    ] },
  ],
};

export function computeScenario(sc = SCENARIO) {
  const meta = { network: sc.network };
  const res = applyLog(sc.blocks, meta);
  const out = structuredClone(sc);
  out.genesis_root = genesisRoot(meta);
  res.blocks.forEach((b, i) => {
    const blk = out.blocks[i];
    blk.results = b.results.map((r) => (r.ok ? "ok" : r.ignored));
    blk.delta = b.entries;
    blk.delta_text_sha256 = b.entries.length ? checkpointHash(deltaText(b.height, b.entries)) : null;
    blk.state_root = b.root;
    const text = encodeCheckpoint(b.state, { ...meta, height: b.height, root: b.root });
    blk.snapshot_hash = checkpointHash(text);
    if (i === res.blocks.length - 1) blk.snapshot = text;
  });
  return out;
}

// ---------------------------------------------------------------------------
// ÐLand conformance
// ---------------------------------------------------------------------------

const L = (o) => ({ p: "Ð:LAND", ...o });
const TT = id("a"), PK = id("b");
const big = "x".repeat(16384);
const deep = (n) => "[".repeat(n) + "]".repeat(n);

const PARSE = [
  ["PACK-001", "Valid pack with inline schema", L({ op: "pack", name: "street-scene", version: "1.0.0", schema: { type: "object" } })],
  ["PACK-002", "Pack missing schema and schema_uri", L({ op: "pack", name: "x", version: "1" })],
  ["PACK-003", "Name is stored verbatim (no trimming)", L({ op: "pack", name: " spaced ", version: "1", schema_uri: "ipfs://z" })],
  ["PACK-004", "schema must be an object", L({ op: "pack", name: "x", version: "1", schema: "object" })],
  ["PACK-005", "null is not a valid value for note", L({ op: "pack", name: "x", version: "1", schema_uri: "ipfs://z", note: null })],
  ["PACK-006", "supersedes must be a canonical lowercase id", L({ op: "pack", name: "x", version: "1", schema_uri: "ipfs://z", supersedes: "B".repeat(64) + "i0" })],
  ["PACK-007", "schema_uri longer than 512 code points", L({ op: "pack", name: "x", version: "1", schema_uri: "ipfs://" + "z".repeat(506) })],
  ["PACK-008", "Name of 64 code points (non-ASCII) is allowed", L({ op: "pack", name: "Ð".repeat(64), version: "1", schema_uri: "ipfs://z" })],
  ["PACK-009", "Name of 65 code points", L({ op: "pack", name: "Ð".repeat(65), version: "1", schema_uri: "ipfs://z" })],
  ["PACK-010", "Version must be printable ASCII", L({ op: "pack", name: "x", version: "1.0\u00e9", schema_uri: "ipfs://z" })],
  ["BUILD-001", "Valid build", L({ op: "build", parcel: 1, title: TT, pack: PK, content: { model: "ipfs://z" } })],
  ["BUILD-002", "Build missing title", L({ op: "build", parcel: 1, pack: PK, content: {} })],
  ["BUILD-003", "Seal without content (keeps live content)", L({ op: "build", parcel: 1, title: TT, pack: PK, seal: true })],
  ["BUILD-004", "Parcel above u32", L({ op: "build", parcel: 4294967296, title: TT, pack: PK, content: {} })],
  ["BUILD-005", "Remove with content", L({ op: "build", parcel: 1, title: TT, pack: PK, remove: true, content: {} })],
  ["BUILD-006", "content null is not an object", L({ op: "build", parcel: 1, title: TT, pack: PK, content: null })],
  ["BUILD-007", "Title with a leading-zero index", L({ op: "build", parcel: 1, title: "a".repeat(64) + "i01", pack: PK, content: {} })],
  ["BUILD-008", "seal must be a boolean", L({ op: "build", parcel: 1, title: TT, pack: PK, content: {}, seal: 1 })],
  ["BUILD-009", "Neither content, remove, nor seal", L({ op: "build", parcel: 1, title: TT, pack: PK })],
  ["BUILD-011", "seal_all is not a field: alone it is not a build", L({ op: "build", parcel: 1, title: TT, pack: PK, seal_all: true })],
  ["BUILD-010", "Negative parcel", L({ op: "build", parcel: -1, title: TT, pack: PK, content: {} })],
  ["ANCHOR-001", "Valid res-12 anchor", L({ op: "anchor", parcel: 1, title: TT, h3_res: 12, h3_cell: CELL_A })],
  ["ANCHOR-002", "Res 9 overlay cell is not an anchor pin", L({ op: "anchor", parcel: 1, title: TT, h3_res: 12, h3_cell: "8928308280fffff" })],
  ["ANCHOR-003", "Clear", L({ op: "anchor", parcel: 1, title: TT, clear: true })],
  ["ANCHOR-004", "Uppercase cell", L({ op: "anchor", parcel: 1, title: TT, h3_res: 12, h3_cell: CELL_A.toUpperCase() })],
  ["ANCHOR-005", "Res-12 bits but digit 12 is 7 (not a cell)", L({ op: "anchor", parcel: 1, title: TT, h3_res: 12, h3_cell: "8c28308280f3fff" })],
  ["ANCHOR-006", "Unused digit below res 12 is not 7", L({ op: "anchor", parcel: 1, title: TT, h3_res: 12, h3_cell: "8c28308280f37f8" })],
  ["ANCHOR-007", "Pentagon base cell with a deleted (leading 1) digit", L({ op: "anchor", parcel: 1, title: TT, h3_res: 12, h3_cell: "8c08400000001ff" })],
  ["ANCHOR-008", "Base cell 122 does not exist", L({ op: "anchor", parcel: 1, title: TT, h3_res: 12, h3_cell: "8cf4000000001ff" })],
  ["ANCHOR-009", "h3_res is required", L({ op: "anchor", parcel: 1, title: TT, h3_cell: CELL_A })],
  ["ANCHOR-010", "Clear must not carry a cell or resolution", L({ op: "anchor", parcel: 1, title: TT, clear: true, h3_res: 12 })],
  ["ANCHOR-011", "Cell with a 0x prefix", L({ op: "anchor", parcel: 1, title: TT, h3_res: 12, h3_cell: "0x" + CELL_A })],
  ["ANCHOR-012", "place must be an inscription id", L({ op: "anchor", parcel: 1, title: TT, h3_res: 12, h3_cell: CELL_A, place: "home" })],
  ["ANCHOR-013", "Valid anchor with a place", L({ op: "anchor", parcel: 1, title: TT, h3_res: 12, h3_cell: CELL_B, place: id("c") })],
  ["P-001", "Wrong marker", L({ p: "Ð:MAPS", op: "pack", name: "x", version: "1", schema: {} })],
  ["P-002", "v is not read (no versions inside the protocol)", L({ v: 7, op: "pack", name: "x", version: "1", schema: {} })],
  ["P-005", "A 0.2-era body with v \"1\" still parses", L({ v: "1", op: "pack", name: "x", version: "1", schema: {} })],
  ["P-003", "Unknown op", L({ op: "mint" })],
  ["P-004", "Unknown keys are ignored", L({ op: "pack", name: "x", version: "1", schema: {}, future: { a: [1] } })],
].map(([cid, description, payload]) => ({ id: cid, description, body: JSON.stringify(payload) }));

const RAW = [
  ["PROF-001", "Fraction in parcel (1.0)", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1.0,"title":"${TT}","pack":"${PK}","content":{}}`],
  ["PROF-002", "Exponent in h3_res (1.2e1)", `{"p":"Ð:LAND","v":"1","op":"anchor","parcel":1,"title":"${TT}","h3_res":1.2e1,"h3_cell":"${CELL_A}"}`],
  ["PROF-003", "Float inside content", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"title":"${TT}","pack":"${PK}","content":{"x":0.5}}`],
  ["PROF-004", "Integer above 2^53-1 inside content", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"title":"${TT}","pack":"${PK}","content":{"x":9007199254740992}}`],
  ["PROF-005", "2^53-1 inside content is fine", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"title":"${TT}","pack":"${PK}","content":{"x":9007199254740991,"y":-9007199254740991}}`],
  ["PROF-006", "-0 is not an integer literal", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"title":"${TT}","pack":"${PK}","content":{"x":-0}}`],
  ["PROF-007", "Duplicate key at the top level", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"parcel":2,"title":"${TT}","pack":"${PK}","content":{}}`],
  ["PROF-008", "Duplicate key in content (after unescaping)", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"title":"${TT}","pack":"${PK}","content":{"ab":1,"a\\u0062":2}}`],
  ["PROF-009", "Lone surrogate escape", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"title":"${TT}","pack":"${PK}","content":{"x":"\\ud800"}}`],
  ["PROF-010", "Escaped surrogate pair is fine", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"title":"${TT}","pack":"${PK}","content":{"x":"\\ud83d\\ude00"}}`],
  ["PROF-011", "Byte-order mark", `\ufeff{"p":"Ð:LAND","v":"1","op":"pack","name":"x","version":"1","schema":{}}`],
  ["PROF-012", "Non-JSON whitespace (U+0085) before the object", `\u0085{"p":"Ð:LAND","v":"1","op":"pack","name":"x","version":"1","schema":{}}`],
  ["PROF-013", "JSON whitespace around the object is fine", ` \n\t{"p":"Ð:LAND","v":"1","op":"pack","name":"x","version":"1","schema":{}}\r\n`],
  ["PROF-014", "Nesting depth 32 (content arrays) is fine", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"title":"${TT}","pack":"${PK}","content":{"d":${deep(30)}}}`],
  ["PROF-015", "Nesting depth 33", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"title":"${TT}","pack":"${PK}","content":{"d":${deep(31)}}}`],
  ["PROF-016", "Body larger than 16384 bytes", `{"p":"Ð:LAND","v":"1","op":"build","parcel":1,"title":"${TT}","pack":"${PK}","content":{"x":"${big}"}}`],
  ["PROF-017", "Trailing bytes after the object", `{"p":"Ð:LAND","v":"1","op":"pack","name":"x","version":"1","schema":{}} x`],
  ["PROF-018", "Top-level array", `[{"p":"Ð:LAND","v":"1","op":"pack","name":"x","version":"1","schema":{}}]`],
].map(([cid, description, body]) => ({ id: cid, description, body }));

function landConformance() {
  const parse_cases = [...PARSE, ...RAW].map((c) => {
    const r = parse(c.body);
    return r.ok ? { ...c, expect: "pass" } : { ...c, expect: "fail", why: r.why };
  });
  const base = { committed: true, op_index: 0, spends_title_outpoint: true, title_is_canonical: true, body_title: TT, canonical_title: TT, title_in_same_tx: false, stale_outpoint: false };
  const AUTH = [
    ["T1-non-holder", "Stranger does not spend the current title UTXO", { spends_title_outpoint: false }],
    ["T2-stale-holder", "Previous holder after transfer: spends an outpoint the title already left", { stale_outpoint: true }],
    ["T4-unbound", "Classic (unbound) reveal: body can be swapped", { committed: false }],
    ["T5-title-mismatch", "Body names a different inscription than the canonical title", { body_title: id("c") }],
    ["T-no-title", "No canonical v1 title for the parcel", { title_is_canonical: false, canonical_title: undefined }],
    ["T-not-vin0", "Op is not the inscription carried by vin[0] (inscription index != 0)", { op_index: 1 }],
    ["T-same-tx-title", "Title is created in the same transaction (not held at the start of it)", { title_in_same_tx: true }],
    ["T-ok", "Current holder spends the title in a committed reveal", {}],
  ].map(([cid, description, over]) => {
    const facts = { ...base, ...over };
    const r = authorize(facts);
    return r.ok ? { id: cid, description, facts, expect: "pass" } : { id: cid, description, facts, expect: "fail", why: r.why };
  });
  const k = (height, tx_index, vout) => ({ height, tx_index, vout });
  const CELL = [
    ["T6-frontrun", "Earlier commit outranks a later reveal-copy", k(10, 1, 0), k(12, 0, 0), 12],
    ["T6-better-commit", "Lower commit key displaces a pending occupant", k(10, 1, 0), k(9, 5, 0), 12],
    ["T7-final", "Final occupant cannot be displaced", k(10, 1, 0), k(1, 0, 0), 41],
    ["T7-last-pending", "tip == key + W is still pending", k(10, 1, 0), k(10, 0, 9), 40],
    ["T7-equal", "Equal keys never displace", k(10, 1, 0), k(10, 1, 0), 12],
    ["T7-vout", "Same height and tx, lower vout wins", k(10, 1, 2), k(10, 1, 1), 12],
  ].map(([cid, description, ex, inc, tip]) => ({
    id: cid, description, existing: { key: ex }, incoming: { key: inc }, tip, can_take: canTakeCell({ key: ex }, { key: inc }, tip),
  }));
  const H3 = [CELL_A, CELL_A2, CELL_B, latLngToCell(51.5007, -0.1246, 12), latLngToCell(35.6586, 139.7454, 12), latLngToCell(-0.0001, -179.9999, 12), latLngToCell(89.9, 0, 12), latLngToCell(-89.9, 10, 12)]
    .map((c) => ({ cell: c, valid: isValidCell(c), district: cellToParent(c, H3_DISTRICT_RES), region: cellToParent(c, H3_REGION_RES) }));
  const INVALID_CELLS = ["8c28308280f3fff", "8c28308280f37f8", "8c08400000001ff", "8cf4000000001ff", "9c28308280f37ff", "8928308280fffff", "0", "ffffffffffffffff"]
    .map((c) => ({ cell: c, valid_res12: isCell(c, 12) }));
  return {
    spec: "Ð:LAND",
    version: "3",
    h3_library: "4.2.1",
    constants: { h3_anchor_res: H3_ANCHOR_RES, h3_district_res: H3_DISTRICT_RES, h3_region_res: H3_REGION_RES, window: WINDOW, max_payload: 16384, max_depth: 32 },
    $comment: "parse: exact body text (UTF-8) -> pass, or fail with the reference reason. Conformant indexers MUST agree on pass/fail; the reason strings are informative. authorize: policy over chain facts (docs/INDEXING.md §5.2). cell: commit-first take rule. h3: parents an indexer MUST compute. Chain scenarios (T1–T8, displacement, finality, reorg) are executable in ../../../vectors/indexer-state.json.",
    parse: parse_cases,
    authorize: AUTH,
    cell: CELL,
    h3: H3,
    invalid_cells: INVALID_CELLS,
  };
}

// ---------------------------------------------------------------------------
// ÐMaps conformance (claims)
// ---------------------------------------------------------------------------

function mapsConformance() {
  const TXT = "text/plain;charset=utf-8";
  const JSN = "application/json";
  const j = (o) => JSON.stringify(o);
  const C = [
    ["CLAIM-001", "Text claim", "0.dogemap", TXT, 100],
    ["CLAIM-002", "Text claim, plain text/plain", "5000000.dogemap", "text/plain", 6000000],
    ["CLAIM-003", "Text claim with application/json media type (read like the existing index)", "7.dogemap", JSN, 100],
    ["CLAIM-004", "Block equal to the confirmation height", "100.dogemap", TXT, 100],
    ["CLAIM-005", "Time travel: block above the confirmation height", "101.dogemap", TXT, 100],
    ["CLAIM-006", "Leading zero", "07.dogemap", TXT, 100],
    ["CLAIM-007", "Sign", "+7.dogemap", TXT, 100],
    ["CLAIM-008", "Leading space (no trimming)", " 7.dogemap", TXT, 100],
    ["CLAIM-009", "Trailing newline (no trimming)", "7.dogemap\n", TXT, 100],
    ["CLAIM-010", "Uppercase suffix", "7.DOGEMAP", TXT, 100],
    ["CLAIM-011", "Two dots", "7.7.dogemap", TXT, 100],
    ["CLAIM-012", "Empty number", ".dogemap", TXT, 100],
    ["CLAIM-013", "Bitmap suffix is not a dogemap", "7.bitmap", TXT, 100],
    ["CLAIM-014", "Image media type", "7.dogemap", "image/png", 100],
    ["CLAIM-015", "No media type", "7.dogemap", null, 100],
    ["CLAIM-016", "text/html is not text/plain", "7.dogemap", "text/html", 100],
    ["CLAIM-017", "Eleven digits is above any real height", "12345678901.dogemap", TXT, 100],
    ["CLAIM-018", "Unicode digits are not digits", "\u0667.dogemap", TXT, 100],
    ["CLAIM-019", "JSON claim: p, op, title.block_height", j({ p: "Ð:MAPS", op: "claim", title: { block_height: 0 } }), JSN, 100],
    ["CLAIM-020", "0.1-era JSON claim (v, chain, tier, geo, fair are not read)", j({ p: "Ð:MAPS", v: "1", op: "claim", chain: "dogecoin", title: { block_height: 12345, tier: "standard" }, geo: { h3_res: 9, h3_cell: dogemapsCell(12345) }, fair: { stake_koinu: "10000000", stake_burn: true } }), JSN, 100000],
    ["CLAIM-021", "A wrong geo cell is not read (the cell is always derived)", j({ p: "Ð:MAPS", op: "claim", title: { block_height: 12345 }, geo: { h3_res: 9, h3_cell: "8928308280fffff" } }), JSN, 100000],
    ["CLAIM-022", "JSON claim in a text/plain inscription", j({ p: "Ð:MAPS", op: "claim", title: { block_height: 0 } }), TXT, 100],
    ["CLAIM-023", "JSON time travel", j({ p: "Ð:MAPS", op: "claim", title: { block_height: 101 } }), JSN, 100],
    ["CLAIM-024", "Top-level block alias is not read", j({ p: "Ð:MAPS", op: "claim", block: 0 }), JSN, 100],
    ["CLAIM-025", "block_height as a string", j({ p: "Ð:MAPS", op: "claim", title: { block_height: "0" } }), JSN, 100],
    ["CLAIM-026", "block_height written as 0.0 (JSON profile)", '{"p":"Ð:MAPS","op":"claim","title":{"block_height":0.0}}', JSN, 100],
    ["CLAIM-027", "Duplicate key (JSON profile)", '{"p":"Ð:MAPS","op":"claim","title":{"block_height":0},"title":{"block_height":1}}', JSN, 100],
    ["CLAIM-028", "Wrong marker", j({ p: "dogemap", op: "claim", title: { block_height: 0 } }), JSN, 100],
    ["CLAIM-029", "Other op", j({ p: "Ð:MAPS", op: "upgrade", title: { block_height: 0 } }), JSN, 100],
    ["CLAIM-030", "params is not an op", j({ p: "Ð:MAPS", op: "params", params: { H3_RES: 8 } }), JSN, 100],
    ["CLAIM-031", "JSON body larger than 8192 bytes", j({ p: "Ð:MAPS", op: "claim", title: { block_height: 0 }, note: "x".repeat(8192) }), JSN, 100],
    ["CLAIM-032", "Any v is fine (no versions inside the protocol)", j({ p: "Ð:MAPS", v: "2", op: "claim", title: { block_height: 0 } }), JSN, 100],
    ["CLAIM-033", "title must be an object", j({ p: "Ð:MAPS", op: "claim", title: 0 }), JSN, 100],
  ].map(([cid, description, body, content_type, height]) => {
    const r = parseClaim(body, content_type, height);
    const c = { id: cid, description, body, content_type, height };
    return r.ok ? { ...c, expect: "pass", block_height: r.block_height, form: r.form } : { ...c, expect: "fail", why: r.why };
  });
  const OFFICIAL = [[0, 9], [1, 9], [12345, 8], [12345, 9], [5000000, 9], [6000000, 9], [999999999, 9]];
  const vectors = OFFICIAL.map(([bh, r]) => ({
    id: `DOGEMAPS-GEO-${bh}-${r}`,
    description: `Official derived cell for (block_height=${bh}, h3_res=${r})`,
    expect: "cell",
    block_height: bh,
    h3_res: r,
    h3_cell: dogemapsCell(bh, r),
  }));
  const geo_batch = [];
  for (let bh = 0; bh < 256; bh++) geo_batch.push(dogemapsCell(bh, 9));
  return {
    $comment: "ÐMaps. claims: body text, content type, confirmation height -> pass (block_height, form) or fail (reference reason; pass/fail is normative, reason strings are informative). vectors: official derived H3 cells (H3 4.2.1). geo_batch: DOGEMAPS_H3(h, 9) for h = 0..255.",
    version: "3",
    protocol: "Ð:MAPS",
    h3_library: "4.2.1",
    claims: C,
    vectors,
    geo_batch,
  };
}

export function buildAll() {
  return {
    "vectors/indexer-state.json": computeScenario(),
    "protocols/dland/vectors/conformance.json": landConformance(),
    "protocols/dogemaps/vectors/conformance.json": mapsConformance(),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const [rel, doc] of Object.entries(buildAll())) {
    writeFileSync(join(root, rel), JSON.stringify(doc, null, 2) + "\n");
    console.log("wrote", rel);
  }
}
