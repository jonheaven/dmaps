/**
 * dmaps-state/3 (docs/INDEXING.md §8): record lines, per-block delta, chained state root,
 * and the dmaps-checkpoint/3 snapshot text.
 */
import { createHash } from "node:crypto";

export const STATE_VERSION = "dmaps-state/3";
export const CHECKPOINT_VERSION = "dmaps-checkpoint/3";
export const H3_VERSION = "4.2.1";

const sha256hex = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/** Minimal RFC 8785 / JCS for profile JSON (objects, arrays, strings, safe integers, booleans, null). */
export function jcs(value) {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  const t = typeof value;
  if (t === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("jcs: only safe integers occur in dmaps bodies");
    return String(value);
  }
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(jcs).join(",") + "]";
  if (t === "object") {
    // JCS sorts keys by UTF-16 code units, which is what Array.prototype.sort does on strings.
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + jcs(value[k])).join(",") + "}";
  }
  throw new Error("jcs: bad type");
}

export function contentHash(content) {
  if (content == null) return "none";
  return sha256hex(jcs(content));
}

const SECTION = { T: 0, P: 1, B: 2, C: 3 };
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Every consensus record as a Map from record key to its line. The key is the line's
 * leading fields: `T <h>`, `P <id>`, `B <parcel> <pack>`, `C <cell>`. That is the whole
 * state: titles, packs, live build slots, and occupied cells.
 */
export function recordLines(state) {
  const m = new Map();
  for (const [h, id] of Object.entries(state.titles)) m.set(`T ${h}`, `T ${h} ${id}`);
  for (const p of Object.values(state.packs)) {
    m.set(`P ${p.id}`, `P ${p.id} ${JSON.stringify(p.name)} ${JSON.stringify(p.version)}`);
  }
  for (const b of Object.values(state.builds)) {
    if (b.content == null && !b.sealed) continue;
    m.set(`B ${b.parcel} ${b.pack}`, `B ${b.parcel} ${b.pack} ${b.sealed ? 1 : 0} ${contentHash(b.content)}`);
  }
  for (const c of Object.values(state.cells)) {
    m.set(`C ${c.h3_cell}`, `C ${c.h3_cell} ${c.parcel} ${c.key.height} ${c.key.tx_index} ${c.key.vout} ${c.anchor_id}`);
  }
  return m;
}

/** Canonical order of record keys: section T,P,B,C; numbers numerically; ids and cells bytewise. */
export function cmpKey(a, b) {
  const sa = SECTION[a[0]];
  const sb = SECTION[b[0]];
  if (sa !== sb) return sa - sb;
  const fa = a.split(" ");
  const fb = b.split(" ");
  switch (a[0]) {
    case "T":
      return Number(fa[1]) - Number(fb[1]);
    case "B":
      return Number(fa[1]) - Number(fb[1]) || cmpStr(fa[2], fb[2]);
    default:
      return cmpStr(fa[1], fb[1]);
  }
}

/** Delta entries between two record maps: `+<line>` for added or changed, `-<key>` for removed. */
export function delta(before, after) {
  const keys = new Set([...before.keys(), ...after.keys()]);
  const out = [];
  for (const k of [...keys].sort(cmpKey)) {
    const a = before.get(k);
    const b = after.get(k);
    if (a === b) continue;
    out.push(b === undefined ? `-${k}` : `+${b}`);
  }
  return out;
}

/** The root before any block: names the format, the network, and the H3 library. Nothing else. */
export function genesisRoot(meta) {
  return sha256hex(`${STATE_VERSION}\nnetwork=${meta.network}\nh3=${H3_VERSION}\n`);
}

export function deltaText(height, entries) {
  return `height=${height}\n` + entries.map((e) => e + "\n").join("");
}

/** A block with no delta entries leaves the root unchanged. */
export function nextRoot(prev, height, entries) {
  if (entries.length === 0) return prev;
  return sha256hex(prev + "\n" + deltaText(height, entries));
}

/** Full snapshot text (dmaps-checkpoint/3) at a height, for audits and bootstrapping comparisons. */
export function encodeCheckpoint(state, meta) {
  const lines = [
    CHECKPOINT_VERSION,
    `network=${meta.network}`,
    `height=${meta.height}`,
    `h3=${H3_VERSION}`,
    `root=${meta.root}`,
  ];
  const m = recordLines(state);
  for (const k of [...m.keys()].sort(cmpKey)) lines.push(m.get(k));
  return lines.join("\n") + "\n";
}

export const checkpointHash = sha256hex;
