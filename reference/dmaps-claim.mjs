/**
 * ÐMaps v1 `claim` validity (docs/INDEXING.md §4). Pure function of the body, the reveal
 * transaction's outputs, the confirmation height, and G (canonical claims confirmed in the
 * previous CLAIM_WINDOW blocks). FCFS between valid claims is the indexer's job (apply.mjs).
 */
import { latLngToCell } from "h3-js";
import { parseBody, isU32 } from "./json-profile.mjs";
import { seedLatLng } from "./dmaps-geo.mjs";

export const MARKER = "Ð:MAPS";
export const MAX_PAYLOAD = 8 * 1024;
export const H3_RES = 9;
export const CLAIM_WINDOW = 2016;
export const ACTIVITY_CAP = 5000;
export const BURN_TAG = "DDMAPBURN";
const U64_MAX = (1n << 64n) - 1n;

/** Stake floor in koinu: 10 * (1000 + min(G, 5000))^2. 0.1 DOGE when quiet, 3.6 DOGE at full activity. */
export function stakeFloor(g) {
  const a = BigInt(1000 + Math.min(Math.max(g, 0), ACTIVITY_CAP));
  return 10n * a * a;
}

/** Derived H3 cell for a block height (§7 of the ÐMaps spec). */
export function dogemapsCell(blockHeight, h3Res = H3_RES) {
  const { lat, lng } = seedLatLng(blockHeight, h3Res);
  return latLngToCell(lat, lng, h3Res);
}

/** scriptPubKey hex of the burn output for `stake` koinu: OP_RETURN <17-byte push "DDMAPBURN" || u64le>. */
export function burnScriptHex(stake) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(stake));
  return "6a11" + Buffer.from(BURN_TAG, "ascii").toString("hex") + b.toString("hex");
}

/** Parse a burn output script; returns the encoded stake (BigInt) or null. */
export function parseBurnScript(hex) {
  if (typeof hex !== "string" || !/^6a11[0-9a-f]{34}$/i.test(hex)) return null;
  const body = Buffer.from(hex.slice(4), "hex");
  if (body.subarray(0, 9).toString("ascii") !== BURN_TAG) return null;
  return body.readBigUInt64LE(9);
}

const STAKE_RE = /^(0|[1-9][0-9]*)$/;

/**
 * @param body bytes or string
 * @param tx { single_tx: bool, outputs: [{ script_hex, value }] }  value in koinu (number or string)
 * @param height confirmation height
 * @param g canonical claims confirmed in [height - 2016, height - 1]
 * @returns { ok:true, block_height, stake } | { ok:false, why }
 */
export function validateClaim(body, tx, height, g) {
  if (tx.single_tx === false) return { ok: false, why: "multi_tx" };
  const r = parseBody(body, MAX_PAYLOAD);
  if (!r.ok) return r;
  const v = r.value;
  if (v.p !== MARKER) return { ok: false, why: "p" };
  if (v.v !== "1") return { ok: false, why: "v" };
  if (v.op !== "claim") return { ok: false, why: "op" };
  if (v.chain !== "dogecoin") return { ok: false, why: "chain" };
  const t = v.title;
  if (!t || typeof t !== "object" || Array.isArray(t)) return { ok: false, why: "title" };
  if (!isU32(t.block_height)) return { ok: false, why: "block_height" };
  if (t.tier !== "standard") return { ok: false, why: "tier" };
  if (t.block_height > height) return { ok: false, why: "time_travel" };
  const geo = v.geo;
  if (!geo || typeof geo !== "object" || Array.isArray(geo)) return { ok: false, why: "geo" };
  if (geo.h3_res !== H3_RES) return { ok: false, why: "h3_res" };
  if (typeof geo.h3_cell !== "string" || geo.h3_cell !== dogemapsCell(t.block_height, H3_RES)) {
    return { ok: false, why: "h3_cell" };
  }
  const fair = v.fair;
  if (!fair || typeof fair !== "object" || Array.isArray(fair)) return { ok: false, why: "fair" };
  if (fair.stake_burn !== true) return { ok: false, why: "stake_burn" };
  if (typeof fair.stake_koinu !== "string" || !STAKE_RE.test(fair.stake_koinu) || fair.stake_koinu.length > 20) {
    return { ok: false, why: "stake_koinu" };
  }
  const stake = BigInt(fair.stake_koinu);
  if (stake > U64_MAX) return { ok: false, why: "stake_koinu" };
  if (stake < stakeFloor(g)) return { ok: false, why: "stake_floor" };
  const burned = (tx.outputs || []).some(
    (o) => parseBurnScript(o.script_hex) === stake && BigInt(o.value) >= stake,
  );
  if (!burned) return { ok: false, why: "no_burn" };
  return { ok: true, block_height: t.block_height, stake: stake.toString() };
}
