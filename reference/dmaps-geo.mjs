/** ÐMaps §7 derived H3 cell. Requires h3-js 4.2.1 (peer). */
import { createHash } from "node:crypto";

export const H3_VERSION = "4.2.1";

export function sha256d(buf) {
  const h1 = createHash("sha256").update(buf).digest();
  return createHash("sha256").update(h1).digest();
}

export function seedLatLng(blockHeight, h3Res) {
  const msg = Buffer.from(`DOGEMAPS/1/GEO/block_height=${blockHeight}/h3_res=${h3Res}/`, "utf8");
  const d = sha256d(msg);
  const a0 = d.readUInt32BE(0);
  const a1 = d.readUInt32BE(4);
  const scale = 1 / 4294967296;
  let lat = a0 * scale * 180 - 90;
  const lng = a1 * scale * 360 - 180;
  if (Math.abs(lat) === 90) lat = 89.99999999999999 * Math.sign(lat);
  return { lat, lng, digest: d.toString("hex") };
}

export async function dogemapsH3(blockHeight, h3Res, latLngToCell) {
  const { lat, lng, digest } = seedLatLng(blockHeight, h3Res);
  const cell = latLngToCell(lat, lng, h3Res);
  return { blockHeight, h3Res, lat, lng, cell, digest };
}

export const OFFICIAL_CELLS = [
  { block_height: 0, h3_res: 9, h3_cell: "89e98d184b7ffff" },
  { block_height: 1, h3_res: 9, h3_cell: "8901a2b054fffff" },
  { block_height: 12345, h3_res: 8, h3_cell: "88f166ced3fffff" },
];
