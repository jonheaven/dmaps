/**
 * dmaps JSON profile (docs/INDEXING.md §2.2). Every ÐMaps and ÐLand body is read through
 * this one function so independent indexers agree on what a body means, byte for byte.
 *
 * A body is valid JSON for these protocols only when all of these hold:
 * - The bytes are strict UTF-8 with no byte-order mark.
 * - The text is one JSON object (RFC 8259). JSON whitespace around it is allowed; nothing else is trimmed.
 * - Nesting depth is at most MAX_DEPTH (the top-level object is depth 1).
 * - Every number is an integer literal (no fraction, no exponent, no "-0") with |n| <= 2^53 - 1.
 * - No string or key contains a lone surrogate escape (for example "\ud800").
 * - No object repeats a key (compared after unescaping).
 */

export const MAX_DEPTH = 32;
const INT_LITERAL = /^(0|-?[1-9][0-9]*)$/; // no "-0"
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/** @returns {{ok:true, value:object, bytes:number} | {ok:false, why:string}} */
export function parseBody(body, maxBytes) {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body);
  if (maxBytes != null && bytes.length > maxBytes) return { ok: false, why: "too_large" };
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    return { ok: false, why: "utf8" };
  }
  let value;
  try {
    value = JSON.parse(text); // grammar; a BOM is not JSON whitespace, so it fails here
  } catch {
    return { ok: false, why: "json" };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, why: "not_object" };
  const why = scan(text);
  if (why) return { ok: false, why };
  return { ok: true, value, bytes: bytes.length };
}

/** Walk text that JSON.parse already accepted and apply the profile rules it cannot see. */
function scan(t) {
  const stack = []; // { obj: bool, keys: Set, wantKey: bool }
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    if (c === "{" || c === "[") {
      stack.push({ obj: c === "{", keys: new Set(), wantKey: c === "{" });
      if (stack.length > MAX_DEPTH) return "depth";
      i++;
    } else if (c === "}" || c === "]") {
      stack.pop();
      i++;
    } else if (c === ",") {
      const top = stack[stack.length - 1];
      if (top && top.obj) top.wantKey = true;
      i++;
    } else if (c === '"') {
      const r = readString(t, i);
      if (r.bad) return "surrogate";
      const top = stack[stack.length - 1];
      if (top && top.obj && top.wantKey) {
        if (top.keys.has(r.value)) return "duplicate_key";
        top.keys.add(r.value);
        top.wantKey = false;
      }
      i = r.end;
    } else if (c === "-" || (c >= "0" && c <= "9")) {
      let j = i;
      while (j < t.length && /[-+0-9.eE]/.test(t[j])) j++;
      const lit = t.slice(i, j);
      if (!INT_LITERAL.test(lit) || !Number.isSafeInteger(Number(lit))) return "number";
      i = j;
    } else {
      i++;
    }
  }
  return null;
}

function readString(t, start) {
  let i = start + 1;
  let out = "";
  let bad = false;
  while (t[i] !== '"') {
    if (t[i] === "\\") {
      const e = t[i + 1];
      if (e === "u") {
        const cu = parseInt(t.slice(i + 2, i + 6), 16);
        i += 6;
        if (cu >= 0xd800 && cu <= 0xdbff) {
          if (t[i] === "\\" && t[i + 1] === "u") {
            const lo = parseInt(t.slice(i + 2, i + 6), 16);
            if (lo >= 0xdc00 && lo <= 0xdfff) {
              out += String.fromCharCode(cu, lo);
              i += 6;
              continue;
            }
          }
          bad = true;
        } else if (cu >= 0xdc00 && cu <= 0xdfff) {
          bad = true;
        } else {
          out += String.fromCharCode(cu);
        }
      } else {
        out += { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" }[e];
        i += 2;
      }
    } else {
      out += t[i];
      i++;
    }
  }
  return { value: out, end: i + 1, bad };
}

/** Canonical inscription id: 64 lowercase hex, `i`, decimal index without leading zeros, <= 2^32-1. */
export function isInscriptionId(s) {
  if (typeof s !== "string") return false;
  const m = /^[0-9a-f]{64}i(0|[1-9][0-9]{0,9})$/.exec(s);
  return !!m && Number(m[1]) <= 0xffffffff;
}

/** Non-negative integer that fits u32. Numbers already passed the integer-literal rule. */
export const isU32 = (n) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
export const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** Count Unicode scalar values (code points). */
export const codePoints = (s) => [...s].length;
