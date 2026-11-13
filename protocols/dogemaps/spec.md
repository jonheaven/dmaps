<!-- markdownlint-disable MD024 -->
# ÐMaps — one title per Dogecoin block

Version: 0.3
Status: Launch Draft
Canonical public repo: [github.com/jonheaven/dmaps](https://github.com/jonheaven/dmaps)
Indexing (normative, shared with ÐLand): [docs/INDEXING.md](../../docs/INDEXING.md)
Optional, non-consensus extensions: [visual renderer](../../docs/extensions/visual-renderer.md), [collector scoring](../../docs/extensions/collector-scoring.md)

The whole protocol is §1–§3. The rest is the derived cell, examples, and the reasons.

---

## 1. Claim

Every Dogecoin block height `n` has at most one **title**. The title is the **first inscription**, in canonical
order (§2), whose complete body is a claim for `n`:

1. **Text** (the existing dogemap convention): the body is exactly the bytes `<n>.dogemap`. `n` is ASCII decimal
   with no sign, no leading zero (except `0` itself), no whitespace, nothing before or after. At most 10 digits.
2. **JSON**: a body that passes the dmaps JSON profile ([INDEXING.md](../../docs/INDEXING.md) §2.2, at most
   8192 bytes) and has `p == "Ð:MAPS"`, `op == "claim"`, and `title.block_height == n` (an integer
   `0 ≤ n ≤ 2^32 − 1`). Every other key is ignored, including `v`, `chain`, `tier`, `geo`, `fair`, `ts` and `note`.

and, in both forms:

- the inscription's content type starts with `text/plain` or `application/json` (as the existing dogemap index
  reads it), and
- `n` is not higher than the height of the block that confirms the body (no time travel; a block may be claimed
  in itself).

Both forms fill **the same slot**. `0.dogemap` and `{"p":"Ð:MAPS","op":"claim","title":{"block_height":0}}`
compete for block 0, and whichever is first holds it. Every later claim for that height is a duplicate and does
nothing.

There is no fee, stake, burn, claim window, signature, registry or parameter feed. The inscription is the cost.

## 2. Order

Canonical order is block height, then transaction index in the block, then inscription order inside the
transaction (the Doginals indexer's order). A body that spans several transactions counts at the transaction that
completes it. That is the whole conflict rule for titles: **first inscription wins**, from the first block, with no
version or activation split.

Reorgs: roll back to the common ancestor and apply the new branch with the same rule. A title that existed only
on the orphaned branch is gone; the height is open until a claim confirms on the best chain.

## 3. Holding

The holder of the title inscription is the owner of the title. A title moves like any inscription: spend its
satpoint. The title id never changes. There is no other owner record, no admin key, and no way for anyone but the
holder to move it. Marketplaces trade the inscription ([ÐMP](https://github.com/jonheaven/dmp/blob/main/spec.md));
there is no ÐMaps settlement primitive.

Everything built on a title — packs, content, a chosen real-world pin — is [ÐLand](../dland/spec.md), which can
change a parcel only in a transaction that spends that title (ÐLand §6).

---

## 4. Derived H3 cell

**Reference:** H3, Uber (Apache-2.0) — [https://github.com/uber/h3](https://github.com/uber/h3) — v4 **API** as
stabilized in each language port.

**MUST (library):** Implementers **MUST** use a conforming H3 4.x `latLngToCell` (or `geoToH3` binding) for the
**resolution** `H3_RES`.

### 4.1 Default resolution

- `H3_RES` = **9**. It is fixed.

### 4.2 Message for hashing (normative)

Let `decimal(n)` = decimal digits of integer `n` with no leading zeros, except the single `0` for
zero.

```text
MSG = UTF-8( "DOGEMAPS/1/GEO/block_height=" || decimal(block_height) || "/h3_res=" || decimal(h3_res) || "/" )
```

### 4.3 Double SHA-256 to latitude, longitude (normative)

- `d = SHA256( SHA256( MSG ) )` (Bitcoin-style **double** SHA-256) — 32 bytes.
- **Interpret** the first 16 bytes as **four** big-endian unsigned 32-bit words `A0, A1, A2, A3`.
- **Bit-exact (MUST) rules for float64 in IEEE-754 (implementation ties to a reference test set):**

  1. `t_lat = (A0 * 2^-32) * 1.0`  // in (0,1) exclusive of upper bound if 2^32 max
  2. `t_lng = (A1 * 2^-32) * 1.0`
  3. `lat = (t_lat * 180.0) - 90.0`  // in [-90, 90)
  4. `lng = (t_lng * 360.0) - 180.0`  // in [-180, 180)
  5. **Pole nudge (MUST):** If `lat` is exactly `90.0` or `-90.0` (rare for exact equality), set
     `lat = 89.999_999_999_999_99 * sign(lat)`; if `lat` is in `(-1e-15, 0)` and numerically a pole edge
     case in the test vectors, nudge the same. Reference implementations **MUST** include three fixed test
     vectors: `(0,9)`, `(1,9)`, `(12345,8)` to lock behavior.

- **Then:** `h3_index = H3.latLngToCell( lat, lng, h3_res )` and `h3_cell` = the **canonical** lowercase hex
  string of that index per the H3 reference.

### 4.4 Verification (MUST)

- The cell is a pure function of `block_height`. It is never read from a body. A `geo` object in an old JSON
  claim is ignored, right or wrong.


### 4.5 H3 library pin and official test cells (MUST)

Implementers **MUST** use a binding to the **Uber H3 C library v4.2.1** (for example `h3-js` 4.2.1, or another language port that is certified against the 4.2.1 C library). A later 4.2.x patch MAY be used only if it produces **identical** `latLngToCell` results for the official cells below. H3 v3 bindings are not conformant.

`latLngToCell` is invoked with the IEEE-754 float64 `lat` and `lng` produced in §4.3 (not a decimal string). The official cells, which every conformant implementation MUST match, are:

| `block_height` | `h3_res` | `h3_cell` (canonical lowercase) |
| --- | --- | --- |
| 0 | 9 | `89e98d184b7ffff` |
| 1 | 9 | `8901a2b054fffff` |
| 12345 | 8 | `88f166ced3fffff` |
| 12345 | 9 | `8908ee22e9bffff` |
| 5000000 | 9 | `89302600dafffff` |
| 6000000 | 9 | `89229d2d337ffff` |
| 999999999 | 9 | `890a0066b4bffff` |

Reference: [../../reference/dmaps-geo.mjs](../../reference/dmaps-geo.mjs). Broader H3 primer: [../../docs/h3.md](../../docs/h3.md). Indexing and state-hash rules: [../../docs/INDEXING.md](../../docs/INDEXING.md).

---

## 5. Examples

| Body | Content type | Confirmed at | Result |
| --- | --- | --- | --- |
| `0.dogemap` | `text/plain;charset=utf-8` | 100 | title for block 0 (if first) |
| `{"p":"Ð:MAPS","op":"claim","title":{"block_height":0}}` | `application/json` | 100 | the same slot as `0.dogemap`: a duplicate if that came first |
| `{"p":"Ð:MAPS","v":"1","op":"claim","chain":"dogecoin","title":{"block_height":5},"geo":{…},"fair":{…}}` | `application/json` | 100 | title for block 5: the 0.1/0.2 extra keys are ignored |
| `101.dogemap` | `text/plain` | 100 | not a claim (`time_travel`) |
| `07.dogemap`, ` 7.dogemap`, `+7.dogemap`, `7.dogemap\n` | `text/plain` | 100 | not a claim (exact bytes only) |
| `7.dogemap` | `image/png` | 100 | not a claim (`media_type`) |
| `{"p":"Ð:MAPS","op":"claim","block":7}` | `application/json` | 100 | not a claim (no `title.block_height`) |
| `{"p":"Ð:MAPS","op":"params",…}` | `application/json` | 100 | not a claim, and not anything else |

Every case, with its reason name, is in [vectors/conformance.json](vectors/conformance.json) (`claims`), next to
the official cells (`vectors`) and 256 `geo_batch` heights. The reference parser is
[../../reference/dmaps-claim.mjs](../../reference/dmaps-claim.mjs).

---

## 6. What ÐMaps is not

- Not legal land. An H3 cell is a public grid, not a deed or a survey.
- Not a token. DRC-20 or other "wrapped dogemap" payloads are not claims; they are just other inscriptions.
- Not a race to win. Value is meant to come from building on titles (ÐLand), not from sniping tip blocks.
  Reference UIs do not ship snipe bots or unclaimed-tip watchlists.

---

## 7. Changelog

### 0.3 — 2026-11-12

Principle: holding the inscription is owning the title, the first valid inscription wins, and the rules fit on
one page (see the [README](../../README.md#design-principles)).

- **Existing dogemaps are titles.** The exact text `<n>.dogemap` is a claim, and it shares one first-wins slot
  with the JSON claim. *Why:* parcels were already inscribed that way and recognized by existing
  dogemap indexes (TAP's dogemap index reads the same text and media types). A new standard should recognize them,
  not orphan them. The 0.2 rule ("legacy text never takes a slot") is removed, and so is the OG/legacy section.
- **JSON claim reduced to three keys.** Only `p`, `op` and `title.block_height` are read. `v`, `chain`, `tier`,
  `geo` and `fair` are ignored. *Why:* the cell is derived, so a claimant-supplied cell could only be wrong; the
  version and chain fields split nothing, so they were trivia that could only make a claim invalid.
- **Stake, `DDMAPBURN` burn and the 2016-block claim window removed.** *Why:* a burn is a fee, and its floor was
  a tunable curve over a moving window: consensus surface that every indexer had to get identical, that made the
  same claim valid or invalid depending on neighbours' activity, and that existing dogemaps never paid. Spam
  costs an inscription fee, like every other inscription. Duplicates cost the duplicate's author and nobody else.
- **`params` stays removed.** *Why:* a parameter feed is an admin key.
- **`i0` and single-transaction rules removed for claims.** *Why:* the Doginals inscription order already gives
  a total order, and the existing text titles were never restricted to `i0`. The strict carrier rules stay where
  they protect someone: ÐLand parcel changes (ÐLand §6).
- **`upgrade` and `link` ops removed.** *Why:* they had no state and no authorization. Building on a parcel is a
  ÐLand `build`, which is holder-gated. Doginals parent/child still works for anything else.
- **Visual renderer (§17) and collector scoring (§18) moved** to `docs/extensions/`. They were always optional
  and non-consensus.
- **No versions or activation heights in the protocol.** The rules apply from the first block. An indexer's
  operator switch is not part of the spec.

### 0.2

Strict JSON profile; `claim` had to be `i0` in one transaction; integer stake floor with a 2016-block window and a
`DDMAPBURN` burn; `params`, per-address caps and aliases removed.

### 0.1

Launch draft.

---

*Dogenals protocol. H3: Uber (Apache-2.0) applies to the H3 library; this document is MIT under the repository
[LICENSE](../../LICENSE).*
