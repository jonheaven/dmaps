/**
 * ÐMaps title claims (docs/INDEXING.md §4). A claim is an inscription whose body is either
 *
 *   - the text `<n>.dogemap` (the existing on-chain convention, Bitmap's rule with "dogemap"), or
 *   - a JSON object with `p: "Ð:MAPS"`, `op: "claim"` and `title.block_height: n`,
 *
 * with a text or JSON media type and `n` no higher than the confirmation height. The first
 * claim for `n`, in inscription order, is the title. There is no fee, stake, or burn: the
 * inscription itself is the cost. This file only decides whether one body is a claim and
 * for which height; first-claim-wins is the indexer's job (apply.mjs).
 */
import { latLngToCell } from "h3-js";
import { parseBody, isU32 } from "./json-profile.mjs";
import { seedLatLng } from "./dmaps-geo.mjs";

export const MARKER = "Ð:MAPS";
export const MAX_PAYLOAD = 8 * 1024;
export const H3_RES = 9;

/** Derived H3 cell of a title (§7 of the ÐMaps spec). Never read from a body. */
export function dogemapsCell(blockHeight, h3Res = H3_RES) {
  const { lat, lng } = seedLatLng(blockHeight, h3Res);
  return latLngToCell(lat, lng, h3Res);
}

/** Media types the existing dogemap index reads: `text/plain…` or `application/json…`. */
export function mediaTypeOk(contentType) {
  return typeof contentType === "string" && (contentType.startsWith("text/plain") || contentType.startsWith("application/json"));
}

const TEXT_RE = /^(0|[1-9][0-9]*)\.dogemap$/;
const SUFFIX = ".dogemap";

/**
 * @param body bytes or string: the complete inscription body
 * @param contentType the inscription's content type string (or null)
 * @param height confirmation height of the transaction that completes the body
 * @returns { ok:true, block_height, form:"text"|"json" } | { ok:false, why }
 */
export function parseClaim(body, contentType, height) {
  if (!mediaTypeOk(contentType)) return { ok: false, why: "media_type" };
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body);
  const text = Buffer.from(bytes).toString("latin1"); // one char per byte
  if (text.endsWith(SUFFIX)) {
    // Exact bytes: no whitespace, no sign, no leading zero, ASCII digits only.
    if (!TEXT_RE.test(text)) return { ok: false, why: "dogemap_text" };
    const digits = text.slice(0, -SUFFIX.length);
    if (digits.length > 10 || Number(digits) > height) return { ok: false, why: "time_travel" };
    return { ok: true, block_height: Number(digits), form: "text" };
  }
  const r = parseBody(bytes, MAX_PAYLOAD);
  if (!r.ok) return r;
  const v = r.value;
  if (v.p !== MARKER) return { ok: false, why: "p" };
  if (v.op !== "claim") return { ok: false, why: "op" };
  const t = v.title;
  if (!t || typeof t !== "object" || Array.isArray(t)) return { ok: false, why: "title" };
  if (!isU32(t.block_height)) return { ok: false, why: "block_height" };
  if (t.block_height > height) return { ok: false, why: "time_travel" };
  return { ok: true, block_height: t.block_height, form: "json" };
}
