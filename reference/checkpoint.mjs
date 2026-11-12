/** dmaps-checkpoint/1 encoder + SHA-256. See docs/INDEXING.md §8. */
import { createHash } from "node:crypto";

/** Minimal RFC 8785 / JCS for JSON made of objects, arrays, strings, integers, booleans, null. No floats. */
export function jcs(value) {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  const t = typeof value;
  if (t === "number") {
    if (!Number.isInteger(value)) throw new Error("jcs: floats are not used in dmaps checkpoints");
    return String(value);
  }
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(jcs).join(",") + "]";
  if (t === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + jcs(value[k])).join(",") + "}";
  }
  throw new Error("jcs: bad type");
}

export function contentHash(content) {
  if (content == null) return "none";
  const body = jcs(content);
  return createHash("sha256").update(body, "utf8").digest("hex");
}

/**
 * @param {object} state
 * @param {object} meta { network, height, maps_activation, land_activation }
 */
export function encodeCheckpoint(state, meta) {
  const lines = [
    "dmaps-checkpoint/1",
    `network=${meta.network}`,
    `height=${meta.height}`,
    `maps_activation=${meta.maps_activation === null || meta.maps_activation === undefined ? "null" : meta.maps_activation}`,
    `land_activation=${meta.land_activation === null || meta.land_activation === undefined ? "null" : meta.land_activation}`,
    "h3=4.2.1",
  ];
  const titles = Object.entries(state.titles || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  for (const [h, id] of titles) lines.push(`T ${h} ${id}`);

  const packs = Object.values(state.packs || {}).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const p of packs) {
    lines.push(`P ${p.id} ${JSON.stringify(p.name)} ${JSON.stringify(p.version)}`);
  }

  const builds = Object.values(state.builds || {}).sort((a, b) => {
    if (a.parcel !== b.parcel) return a.parcel - b.parcel;
    return a.pack < b.pack ? -1 : a.pack > b.pack ? 1 : 0;
  });
  for (const b of builds) {
    if ((b.applied || 0) === 0 && !b.sealed) continue;
    lines.push(`B ${b.parcel} ${b.pack} ${b.applied || 0} ${b.sealed ? 1 : 0} ${contentHash(b.content)}`);
  }

  const cells = Object.values(state.cells || {}).sort((a, b) => (a.h3_cell < b.h3_cell ? -1 : 1));
  for (const c of cells) {
    lines.push(
      `C ${c.h3_cell} ${c.parcel} ${c.key.height} ${c.key.tx_index} ${c.key.vout} ${c.from_commit ? 1 : 0} ${c.anchor_id}`,
    );
  }

  const districts = Object.values(state.districts || {}).sort((a, b) => (a.district < b.district ? -1 : 1));
  for (const d of districts) {
    lines.push(
      `D ${d.district} ${d.founder_parcel} ${d.anchor_id} ${d.final_ ? 1 : 0} ${d.key.height} ${d.key.tx_index} ${d.key.vout}`,
    );
  }

  return lines.join("\n") + "\n";
}

export function checkpointHash(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
