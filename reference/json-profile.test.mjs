import assert from "node:assert/strict";
import test from "node:test";
import { parseBody, isInscriptionId, isU32 } from "./json-profile.mjs";

const ok = (t, m) => parseBody(t, m).ok;
const why = (t, m) => parseBody(t, m).why;

test("grammar and framing", () => {
  assert.equal(ok('{"a":1}'), true);
  assert.equal(ok(' \t\r\n{"a":1}\n'), true);
  assert.equal(why('\ufeff{"a":1}'), "json");
  assert.equal(why("[1]"), "not_object");
  assert.equal(why("null"), "not_object");
  assert.equal(why('{"a":1} {}'), "json");
  assert.equal(why(new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d])), "utf8");
  assert.equal(why('{"a":1}', 6), "too_large");
  assert.equal(ok('{"a":1}', 7), true);
});

test("numbers are integer literals within 2^53-1", () => {
  for (const n of ["0", "-1", "9007199254740991", "-9007199254740991"]) assert.equal(ok(`{"a":${n}}`), true, n);
  for (const n of ["1.0", "1e0", "1E2", "-0", "9007199254740992", "-9007199254740992", "0.5"]) {
    assert.equal(why(`{"a":${n}}`), "number", n);
  }
  assert.equal(ok('{"a":"1.5e3"}'), true, "numbers inside strings are text");
});

test("depth, duplicates, surrogates", () => {
  const nest = (n) => '{"a":' + "[".repeat(n) + "]".repeat(n) + "}";
  assert.equal(ok(nest(31)), true);
  assert.equal(why(nest(32)), "depth");
  assert.equal(why('{"a":1,"a":2}'), "duplicate_key");
  assert.equal(why('{"a":1,"\\u0061":2}'), "duplicate_key");
  assert.equal(ok('{"a":{"a":1},"b":{"a":1}}'), true, "same key in sibling objects");
  assert.equal(ok('{"a":["a","a"]}'), true, "array strings are not keys");
  assert.equal(why('{"a":"\\udc00"}'), "surrogate");
  assert.equal(why('{"\\ud800":1}'), "surrogate");
  assert.equal(ok('{"a":"\\ud83d\\ude00"}'), true);
  assert.equal(ok('{"a":"\\\\ud800"}'), true, "escaped backslash, not an escape");
});

test("inscription ids and u32", () => {
  const h = "0".repeat(64);
  assert.equal(isInscriptionId(h + "i0"), true);
  assert.equal(isInscriptionId(h + "i4294967295"), true);
  assert.equal(isInscriptionId(h + "i4294967296"), false);
  assert.equal(isInscriptionId(h + "i01"), false);
  assert.equal(isInscriptionId("A".repeat(64) + "i0"), false);
  assert.equal(isInscriptionId(h + "i"), false);
  assert.equal(isInscriptionId(h + "i0 "), false);
  assert.equal(isU32(4294967295), true);
  assert.equal(isU32(4294967296), false);
  assert.equal(isU32(-1), false);
});
