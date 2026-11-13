<!-- markdownlint-disable MD024 -->
# ÐMaps — Block Title and Geo-Overlay Protocol (Dogenals)

Version: 0.2
Status: Launch Draft
Canonical public repo: [github.com/jonheaven/dmaps](https://github.com/jonheaven/dmaps)
Indexing (deterministic, shared with ÐLand): [docs/INDEXING.md](../../docs/INDEXING.md)

Chain: Dogecoin. `chain` is the literal `"dogecoin"` on every network (mainnet, testnet, regtest), so a body never means different things on different networks.

**Naming:** **ÐMaps** is the Dogenals-era standard name (aligned with ÐMP, ÐMS). The inscription JSON protocol id
**`p`** **MUST** remain the literal string **`Ð:MAPS`** so existing indexers and inscriptions stay
interoperable; documentation uses **ÐMaps** except when citing the on-chain field value.

---

## Table of Contents

1. Introduction (includes **Principles**, informative)
2. Terminology
3. Design Summary
4. Envelope and Protocol Marker
5. Title Model and Canonical Ordering
6. Operations
   - 6.1 claim
   - 6.2 upgrade
   - 6.3 link
   - 6.4 params (removed in 0.2)
7. H3 Geospatial Derivation
8. FCFS, Validity, and Indexer State
9. Fairness, Anti-Abuse, and Economic Friction
10. Building on Titles (Value from Construction)
11. ÐMP (Doginals Marketplace Protocol) Integration
12. Legacy: OG dogemaps (v0 / community)
13. Security Considerations
14. Indexer Reference Algorithm
15. Operation Examples (at least 10)
16. Comparison: Bitcoin Bitmaps and prior community dogemaps
17. Visual Renderer Extension (v1)
18. Collector Scoring & Ranking Extension (v1)
19. Future extensions
20. Changelog

---

## 1. Introduction

ÐMaps is a **Dogenals-only** (pure inscription JSON) standard that binds a verifiable, transferable **title**
to each **block height** on Dogecoin, and derives a deterministic **H3** (Uber hexagonal hierarchical spatial
index) **cell** at a fixed resolution for use in geo, metaverse, and routing layers. It extends “Bitmap-style”
**block** association with **unambiguous indexer rules** (first valid claim wins), **economic friction** against
**bulk hoarding**, and a clear path for **ÐMP** trading and **dynamic** collections (including *de facto* infinite
titles — one per block, forever — described via metadata).

ÐMaps is a Dogenals-native coordinate and title layer: it turns the continuing Dogecoin chain into an open,
fair, deterministic spatial index (via H3) keyed by `block_height`. The standard is designed so no marketplace,
founder wallet, or private registry can monopolize title validity; the chain, canonical ordering, H3
derivation, and explicit anti-abuse rules decide.

**Design goal:** Titles are FCFS. The social title for a claimed block remains **`<height>.dogemap`** (see §2);
value SHOULD come from **on-chain** building (child inscriptions, linked data, Dunes-integrated features,
ÐMP-driven commerce), not from vacuum-sealed numeric hoarding.

### Principles (informative)

ÐMaps is built on four principles that guide every rule in this specification:

- **Decentralized** — Title validity is determined solely by public chain data, canonical ordering, and deterministic validation. No marketplace, founder wallet, indexer, or private registry can mint, override, or invalidate canonical titles outside these rules.

- **Fair** — FCFS with transparent economic friction (a burned stake floor that rises with activity, activity-weighted scoring) applies identically to every participant. The origin of a valid inscription — whether self-mined or purchased from any marketplace — confers neither privilege nor penalty at the protocol layer.

- **Trusted** — Every normative claim is independently verifiable: H3 cells are recomputed from the same formula, stakes are attested on-chain, duplicates are dropped by identical ordering, and reorgs are replayed the same way by any correct implementation. Optional extensions (§17 visual renderer, §18 collector scoring) are versioned and fully reproducible.

- **Desired** — The core title layer stays minimal and stable so builders can confidently extend it with visuals, ÐMP commerce, Doge𝕏ID reputation, metaverse layers, or future protocols without fighting the foundation. Optional extensions remain optional; the protocol wins by being the shared, unopinionated base that makes every good-faith implementation stronger.

- **Anti-extractive (product intent)** — ÐMaps is a **reboot** of community dogemaps, not a faster sniper. Value **SHOULD** come from building on titles (`upgrade` / `link` / ÐMP collections / games / H3 overlays), not from winning a minutes-long race after each block with bots. Protocol and reference UIs **MUST NOT** treat “claim frontier sniping,” watchlists of unclaimed tip blocks, or automated arm-and-fire mint bots as first-class success metrics. Economic friction (§9) exists to raise the cost of bulk claiming and monopolies; it is not an invitation to optimize latency races.

These principles keep ÐMaps aligned with “Do Only Good Every Day”: open rules, verifiable outcomes, and a level playing field that rewards on-chain building over extraction or monopoly.

### 1.1 In Scope

- Inscription `JSON` with `p: "Ð:MAPS"`.
- A single **normative** `standard` tier per `block_height` in v1.
- H3 v4 string/index form at a configurable resolution `H3_RES` (default 9).
- ÐMP for listings, offers, and transfers of the **claim** (and any **upgrade**) inscriptions.

### 1.2 Out of Scope

- Consensus, miner payment, or chain hard-forking behavior.
- Off-chain oracles for “real world” property law.
- DRC-20 or wrapped / bridged “Dogemap tokens” (forbidden; see §4.2).

### 1.3 Size

- A body larger than **8192 bytes** is **not** a ÐMaps op. Every body MUST satisfy the dmaps JSON profile
  ([INDEXING.md](../../docs/INDEXING.md) §2.2): strict UTF-8, one object, no duplicate keys, integers only,
  depth ≤ 32, strict types, `null` never valid for a named field.
- Unknown top-level and nested object keys **MUST** be **ignored** by indexers, except for keys explicitly
  **forbidden** in this spec.

---

## 2. Terminology

- **Dogenals inscription** — A Doginals/Ord-style inscription; **inscription_id** = `<reveal_txid> i <vout>` in
  lowercase 64-hex + `i` + decimal vout, as in [ÐMP Section 2](https://github.com/jonheaven/dmp/blob/main/spec.md#2-terminology) (`<txid>i<vout>`).
- **Block height (title key)** — Non-negative integer. **Genesis** = `0` for Dogecoin mainnet unless a chain
  fork redefines the first block (indexer **MUST** use the chain’s canonical `height` of the **block header**).
- **H3 / `h3_cell` —** Canonical lowercase hex H3 string as produced by the reference H3 4.x API
  `h3ToString` / `cellToStr` (binding name to implementation).
- **Canonical order** — The total order of inscription-bearing transactions:
  1. **Confirmation block height** (ascending),
  2. **Transaction index** within the block (ascending),
  3. **Output index** `vout` of the **reveal** (ascending),
  4. If a single transaction inscribes multiple times, the **inscription order** is the order defined by the
     Doginals indexer (ordinal of inscription in the tx). If unavailable, `vout` and then a documented
     secondary key **MUST** be used consistently.

  This order **MUST** match the spirit of ÐMP’s rule for “simultaneous” events so that reorgs and competing
  claims are deterministic. See ÐMP: `block_height ASC`, `tx_index_in_block ASC` (ÐMP Section 2,
  **Canonical ordering**).

- **Controller / owner** — The Dogecoin address that controls the inscription UTXO (same model as ÐMP
  ownership for marketplace visibility).

- **Valid / invalid** — An ÐMaps protocol inscription is **valid** or **invalid** for protocol state. **Invalid** ops
  **MUST** not mutate canonical title state. Indexers **SHOULD** not surface invalid ops as “claims.”

- **Dogemap title (informative label)** — The familiar block-title label from the Doginals dogemap community:
  **`<decimal(block_height)>.dogemap`**, often shown with a leading **`#`** in UIs (e.g. `#5000000.dogemap`).
  It is **not** a second protocol key: canonical identity remains `( chain_id, block_height, tier )` and the
  **`claim` `inscription_id`**. Wallets **SHOULD** display this label next to `title.block_height`.

---

## 3. Design Summary

| Item | Value |
| --- | --- |
| `p` | `Ð:MAPS` |
| `v` | `1` (string) |
| **Primary key** | `( chain_id, block_height, tier )` with `tier = "standard"` in v1 |
| **H3** | `DOGEMAPS_H3( block_height, h3_res )` at `H3_RES` (default 9) |
| **ÐMP** | `list`, `settle`, `transfer`, `collection` against `inscription_id` of **claim** or **upgrade** |

---

## 4. Envelope and Protocol Marker

### 4.1 Every op (MUST)

- `p`: `Ð:MAPS`
- `v`: `1`
- `op`: one of `claim` | `upgrade` | `link`
- `chain`: `dogecoin`

A `claim` MUST be the first inscription (`i0`) of its reveal transaction with the whole body in that one
transaction ([INDEXING.md](../../docs/INDEXING.md) §2.1).

**Optional (no protocol semantics for ordering or validity):** `ts` (Unix time integer), `nonce` (string),
`note` (string, human-readable, max 500 chars; indexers **MAY** truncate in APIs).

### 4.2 Forbidden (MUST be invalid under ÐMaps)

- The payload is recognized by the indexer as a DRC-20 or non-Dogenals “wrapped” **deploy/mint/transfer** that
  hijacks the same UTXO with competing semantics, **or** the `p` value is not exactly `Ð:MAPS` in the
  top-level object used for ÐMaps.
- A **fake** JSON embedded only in `OP_RETURN` (or elsewhere) **without** a valid Dogenals inscription envelope
  carrying the same payload. ÐMaps **MUST** apply to **inscription payloads** only (pure Dogenals; see
  introduction).

**SHOULD** Mark such attempts as `spam` or `invalid` in APIs.

### 4.3 Witness envelope (MUST / SHOULD)

- **New `claim`, `upgrade`, and `link` inscriptions** **SHOULD** use the **`dog`** witness envelope
  (Dogenals Era 2): same **placement**, **reveal**, and **JSON semantics** as Doginals v1 **`ord`** inscriptions,
  but with the **`dog`** marker and envelope rules in [Dog marker envelope](../../docs/dog-marker-envelope.md)
  and the unified marker policy in [Multi-marker Era 1 compatibility](../../docs/dog-marker-envelope.md).
  Payload **MUST** remain the JSON object validated by this spec (§4.1, §6).

- **`ord`** witness envelope (Doginals / Dogenals Era 1) **MAY** carry the same JSON; indexers **MUST** treat a
  valid payload under **`ord`** or **`dog`** identically for ÐMaps **protocol state**, if their deployment
  documents Era 1 support. This preserves parity with existing tooling while steering **new** mints to **`dog`**.

- Wallets and indexers **MUST NOT** label `drc-20`-**wrapped** payloads as ÐMaps, even if JSON is copied.

---

## 5. Title Model and Canonical Ordering

### 5.1 Uniqueness

- The **title** (canonical **claim**) for `( chain_id, block_height, "standard" )` **MUST** be at most one
  inscription. The **first** (§2, canonical order) **valid** `op: "claim"` establishes the **canonical** title.
- Every later `claim` for the same key **MUST** be `invalid` (dropped; no overwrites; no “upgrade” of title
  through second `claim`).

### 5.2 H3 Is Not a Second Uniqueness Key

- The **H3** cell is **derived** from `block_height` and **MUST** be recomputable. Two different
  `block_height` values that map to the same H3 (theoretically possible at very low resolution) **MUST** still
  be **distinct titles**. Uniqueness is only `( chain_id, block_height, tier )`.

### 5.3 Reorgs

- On a chain reorganization, indexers **MUST** roll back to the common ancestor and re-apply. **First valid
  claim** after reprocessing **MUST** define **canonical** state. If a previously canonical claim is orphaned, the
  title is **unclaimed** until a new **valid** claim (possibly the same content re-mined) appears in the new
  best chain; FCFS re-applies.

---

## 6. Operations

### 6.1 `claim` — Inscribe a Block Title

Binds an **ÐMaps claim** to `title.block_height` and `title.tier: "standard"`, with verified `h3_cell` and
stake (§9).

#### 6.1.1 Core schema (MUST)

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "claim",
  "chain": "dogecoin",
  "title": {
    "block_height": 1234567,
    "tier": "standard"
  },
  "geo": {
    "h3_res": 9,
    "h3_cell": "8928308280fffff"
  },
  "fair": {
    "stake_koinu": "5000000000",
    "stake_burn": true
  }
}
```

#### 6.1.2 Field rules (MUST)

- `title.block_height` **MUST** be a JSON integer `0 ≤ n ≤ 2^32 − 1`.
- **Maturity (anti time-travel):** Let `H` = confirmation **block height** of the `claim` inscription. Indexers
  **MUST** require `title.block_height ≤ H`.
- `title.tier` **MUST** be the string `standard` in v1. Other values are **MUST** `invalid` until a future
  version of this spec defines them.
- `geo.h3_res` **MUST** be `9`.
- `geo.h3_cell` **MUST** equal the **exact** string from `DOGEMAPS_H3( title.block_height, geo.h3_res )` in §7.
- `fair.stake_koinu` **MUST** be a **decimal string of koinu** (no sign, no leading zero except the single
  `0` for zero, at most 20 digits, value ≤ `2^64 − 1`), matching [ÐMP numeric strings](https://github.com/jonheaven/dmp/blob/main/spec.md).
- `fair.stake_burn` **MUST** be the JSON boolean `true` in v1.
- The **inscribing transaction** of the `claim` **MUST** satisfy the **stake** rule in §9. If not, the claim
  is `invalid`.
- The **current owner of the `claim` inscription** at confirmation is the **title holder**; transfer is the
  Dogenals + ÐMP UTXO transfer, not a second `claim`.

### 6.2 `upgrade` — Parent / Child and Layers

A **new** inscription (child) that does **not** re-target `block_height` but refines, themes, or layers
metadata on a **parent** ÐMaps inscription (a prior **canonical** `claim` or a **valid** `upgrade` whose
ancestry reaches a canonical `claim`).

#### Schema (MUST)

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "upgrade",
  "chain": "dogecoin",
  "parent": {
    "inscription_id": "abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdi0",
    "relation": "overlays/terrain-v2"
  }
}
```

#### Rules (MUST)

- `parent.inscription_id` **MUST** reference an inscription on-chain. At confirmation, that inscription **MUST**
  be a **valid** `Ð:MAPS` op whose state traces to a **canonical** `claim` (via zero or more `upgrade` steps).
- If the parent is not a valid ÐMaps op or does not trace to a canonical `claim`, this `upgrade` is
  `invalid` for ÐMaps.
- `parent.relation` **SHOULD** be a path-like id for UX (no formal charset beyond UTF-8 max 256 chars; longer
  **MUST** be truncated in display).

`upgrade` does **not** create a new **block** title. It is a **separate** tradable **doginal**; ÐMP can list
it on its own `inscription_id`.

### 6.3 `link` — Linked inscriptions and URIs

**Optional** op for a graph of `rel` + `uri` (IPFS, HTTPS, etc.) attached to a **claim** or `upgrade` target.

#### Schema (MUST)

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "link",
  "chain": "dogecoin",
  "of": "abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdi0",
  "hrefs": [ { "rel": "3d", "uri": "ipfs://bafy..." } ]
}
```

- `of` **MUST** be an inscription that is a valid `claim` or `upgrade` in the same logical graph, or a `link`
  whose `of` eventually points to a valid root (indexers **MAY** only index **one** hop in v1 for
  simplicity, but **MUST** document policy).

### 6.4 `params` — removed in 0.2

There is no `params` op. A signed parameter feed is a trusted party: whoever holds the key could change the
resolution or the stake rule for everyone. Every constant in this spec is fixed; changing one is a dated spec
revision that every indexer adopts from the same height. An inscription with `op: "params"` is not a ÐMaps op.

---

## 7. H3 Geospatial Derivation

**Reference:** H3, Uber (Apache-2.0) — [https://github.com/uber/h3](https://github.com/uber/h3) — v4 **API** as
stabilized in each language port.

**MUST (library):** Implementers **MUST** use a conforming H3 4.x `latLngToCell` (or `geoToH3` binding) for the
**resolution** `H3_RES`.

### 7.1 Default resolution

- `H3_RES` = **9**. It is fixed.

### 7.2 Message for hashing (normative)

Let `decimal(n)` = decimal digits of integer `n` with no leading zeros, except the single `0` for
zero.

```text
MSG = UTF-8( "DOGEMAPS/1/GEO/block_height=" || decimal(block_height) || "/h3_res=" || decimal(h3_res) || "/" )
```

### 7.3 Double SHA-256 to latitude, longitude (normative)

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

### 7.4 Verification (MUST)

- Indexers **MUST** recompute `h3_cell` and **MUST** reject a `claim` with a mismatch. The **claimant-provided
  value** is a convenience; verifiers do not trust it.


### 7.5 H3 library pin and official test cells (MUST)

Implementers **MUST** use a binding to the **Uber H3 C library v4.2.1** (for example `h3-js` 4.2.1, or another language port that is certified against the 4.2.1 C library). A later 4.2.x patch MAY be used only if it produces **identical** `latLngToCell` results for the official cells below. H3 v3 bindings are not conformant.

`latLngToCell` is invoked with the IEEE-754 float64 `lat` and `lng` produced in §7.3 (not a decimal string). The official cells, which every conformant implementation MUST match, are:

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

## 8. FCFS, Validity, and Indexer State

For each `chain_id` and v1, indexers **MUST** keep:

- `state[ chain_id, block_height, "standard" ] -> canonical_claim_inscription_id | null`

**Rules (MUST):**

1. The first `valid` `claim` in canonical order sets the value if currently `null`.
2. A second `valid` `claim` for the same key **MUST** have no effect; mark **invalid (duplicate title)** in
   APIs if desired.
3. **Invalid** claims **MUST** not set state.

**Optional side index (SHOULD):** The latest `h3_cell` and `H` (confirm height) for the canonical `claim` for
explorers and maps.

---

## 9. Fairness, Anti-Abuse, and Economic Friction

The rules below are **MUST** for a conforming indexer. They are integer functions of confirmed chain data:
no address heuristics, no fee estimation, no trusted parameter feed. The normative text is
[INDEXING.md](../../docs/INDEXING.md) §4.

### 9.1 No per-address caps (removed in 0.2)

Per-address claim caps and burst limits are gone. Addresses are free to create, so a cap only taxed honest
users and needed each indexer to agree on "which address claimed" (inputs? change? the inscription owner?).
The stake floor and a real burn price every claim the same way for everyone.

### 9.2 Stake floor (activity-based ramp)

- `G` = number of **canonical titles** confirmed at heights `[H − 2016, H − 1]`, where `H` is the claim's
  confirmation height. Claims in block `H` itself do not count, so order inside a block cannot change the floor.
- `min_stake_floor = 10 × (1000 + min(G, 5000))²` koinu.

This is exact integer arithmetic. It equals the 0.1 formula `10_000_000 × (1 + 5 × min(1, G/5000))²` at every
`G`, with no rounding: 0.1 DOGE when quiet, rising to 3.6 DOGE at `G ≥ 5000`. Vectors: `floors` in
[vectors/conformance.json](vectors/conformance.json).

### 9.3 Burn output in the claim transaction (MUST)

The reveal transaction of the `claim` **MUST** have an output whose scriptPubKey is exactly

```text
6a 11 44444d41504255524e <u64le(stake_koinu)>
   OP_RETURN, push 17 bytes: "DDMAPBURN" then the stake as 8 little-endian bytes
```

with value `≥ stake_koinu`, and `stake_koinu ≥ min_stake_floor`. OP_RETURN outputs are unspendable, so the
stake is destroyed and cannot be recycled across claims. Fees are not stake (they go to a miner, who may be
the claimant).

### 9.4 Sybil

- UTXO-level Sybil is inherent. The burn makes every claim cost the same for everyone; the floor rises with
  activity so bulk claiming gets more expensive exactly when the chain is busy.

---

## 10. Building on Titles (Value from Construction)

- **MUST (social norm):** Document that **durable value** (utility, art, Dunes, games) is expected in
  `upgrade` and `link` layers and ÐMP `collection` activity — not in bare `block_height` idleness.
- A **common** `block_height` (non-genesis) is intentionally **abundant in social terms**; rarity **SHOULD** come
  from design, curation, and on-chain work.

---

## 11. ÐMP (Doginals Marketplace Protocol) Integration

- **MUST (trading):** Titles and upgrades are **inscriptions**; ÐMP’s `list`, `bid`, `settle`, `cancel`,
  `collection`, and `v1.0` `transfer` **MUST** be used for marketplace and provenance, per
  [ÐMP spec](https://github.com/jonheaven/dmp/blob/main/spec.md). There is no ÐMaps-specific settlement primitive.

- **ÐMP `collection` and supply semantics (MUST, extension namespace):** ÐMP’s `type: "dynamic"` and
  `criteria.mode: "rule_based"` **MUST** be used when a manifest describes **unbounded** membership. Place a
  **Dogenals extension object** in the ÐMP `collection` JSON (unknown fields are ignored by ÐMP, per
  ÐMP’s convention):

```json
{
  "dogenals": {
    "title_protocol": "dogemaps",
    "protocol_version": "1",
    "supply_model": "per_block"
  }
}
```

**Allowed** `dogenals.supply_model` strings in manifests that describe ÐMaps **sets**:

- `per_block` — One **canonical** title per `block_height` (as defined here).
- `infinite` — “No off-chain fixed cap in metadata for the *collection’s* art layer”; **MUST** not contradict
  the **one-claim-per-block** rule: it refers to *collection* composition (e.g. all allowed **upgrades** and
  **artistic** inscriptions for each block, not a second `claim`).

- **MUST (criteria hint):** Use `rule_based` with a rule like `{ "p": "Ð:MAPS" }` under `criteria` in line with
  ÐMP Section 9, **or** an explicit `inscription_ids` / creator-signed `signed_list` (ÐMP) for a **finite
  subset of upgrades**.

---

## 12. Legacy: OG dogemaps (v0 / community)

- **MUST (labeling):** Any pre-standard inscription that community tools historically called a “dogemap” but
  that does **not** have `p: "Ð:MAPS", v: "1"` in the Dogenals JSON is **`OG` / “OG v1” (legacy)**.
- **MUST (FCFS):** A valid v1 `claim` **MUST** **win** the canonical `block_height` title in indexer state. **OG
  v0** inscriptions **MUST NOT** overwrite or block a v1 `claim` for the same `block_height` when both exist.
- **SHOULD (UX):** Wallets and explorers show `badge: "OG (legacy)"` and link to the v1 `claim` as **canonical
  title** if present.

---

## 13. Security Considerations

- **MUST** Distinguish DRC-20 and wrapped **spam** (§4.2).
- **Griefing:** The burned stake prices every empty claim; it is not eliminated.
- **Reorgs (§5.3):** Title can flip in extreme deep reorg; ÐMP and ownership follow the **best** chain.
- **Geo and law:** H3 is not legal land. **MUST** not be represented as a government land registry.
- **ÐMP** listing of an inscription the seller does not own remains **invalid** under ÐMP; ÐMaps does not
  add exceptions.

---

## 14. Indexer Reference Algorithm (Pseudocode)

```text
state = map ()  // (chain, height, "standard") -> inscription_id
for each block b in order:
  for each inscription ins in b in DOGENALS_CANONICAL_ORDER( b ):
    j = try_parse_json( ins )
    if j is None or j.p != "Ð:MAPS": continue
    if j.v != "1": mark unsupported; continue
    if j.chain != "dogecoin": invalid; continue
    if j.op == "claim":
       if ins is not i0 or not single_tx( ins ): invalid; continue
       if not claim_schema_ok( j ): continue           // INDEXING §2.2 profile + §4 fields
       if j.title.block_height > b.height: invalid; continue
       if recompute( j ) != j.geo.h3_cell: invalid; continue
       G = titles confirmed in [b.height - 2016, b.height - 1]
       if stake < 10 * (1000 + min(G, 5000))^2: invalid; continue
       if no output == OP_RETURN "DDMAPBURN" u64le(stake) with value >= stake: invalid; continue
       key = (j.chain, j.title.block_height, "standard")
       if key in state: duplicate; continue
       if j.title.tier != "standard": invalid; continue
       state[key] = ins.inscription_id
    // upgrade, link: validate graph rules; optional indexes
reorg: rollback and rerun from common ancestor
```

---

## 15. Operation Examples (at least 10)

Every claim example needs a burn output `6a11 44444d41504255524e <u64le(stake_koinu)>` with value ≥ the stake in
the same transaction (§9.3). Examples below use **official H3 4.2.1 cells** (also listed in §7.5). Indexers **MUST** recompute
`h3_cell` with `DOGEMAPS_H3(block_height, h3_res)` and reject mismatches; the values in the JSON
are not trusted, they are the expected result.

### E1 — Claim genesis block 0

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "claim",
  "chain": "dogecoin",
  "title": { "block_height": 0, "tier": "standard" },
  "geo": { "h3_res": 9, "h3_cell": "89e98d184b7ffff" },
  "fair": { "stake_koinu": "20000000", "stake_burn": true }
}
```

### E2 — Claim a recent block

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "claim",
  "chain": "dogecoin",
  "title": { "block_height": 5000000, "tier": "standard" },
  "geo": { "h3_res": 9, "h3_cell": "89302600dafffff" },
  "fair": { "stake_koinu": "10000000", "stake_burn": true },
  "note": "Standard claim for a mature block."
}
```

### E3 — Duplicate claim (invalid after E1)

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "claim",
  "chain": "dogecoin",
  "title": { "block_height": 0, "tier": "standard" },
  "geo": { "h3_res": 9, "h3_cell": "89e98d184b7ffff" },
  "fair": { "stake_koinu": "50000000", "stake_burn": true },
  "note": "Invalid duplicate if E1 is already canonical on the best chain."
}
```

### E4 — Wrong H3 cell (invalid)

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "claim",
  "chain": "dogecoin",
  "title": { "block_height": 12345, "tier": "standard" },
  "geo": { "h3_res": 9, "h3_cell": "8928308280fffff" },
  "fair": { "stake_koinu": "10000000", "stake_burn": true }
}
```

The official cell for `(12345, 9)` is `8908ee22e9bffff`. `8928308280fffff` does not match, so this **MUST** be invalid.

### E5 — Time-travel claim (invalid)

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "claim",
  "chain": "dogecoin",
  "title": { "block_height": 999999999, "tier": "standard" },
  "geo": { "h3_res": 9, "h3_cell": "890a0066b4bffff" },
  "fair": { "stake_koinu": "10000000", "stake_burn": true }
}
```

Invalid if the inscription confirms before `block_height` exists.

### E6 — Insufficient stake (invalid)

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "claim",
  "chain": "dogecoin",
  "title": { "block_height": 6000000, "tier": "standard" },
  "geo": { "h3_res": 9, "h3_cell": "89229d2d337ffff" },
  "fair": { "stake_koinu": "1", "stake_burn": true }
}
```

### E7 — Terrain `upgrade` child

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "upgrade",
  "chain": "dogecoin",
  "parent": {
    "inscription_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0",
    "relation": "overlays/terrain"
  },
  "layer": {
    "kind": "terrain",
    "name": "Koinu Ridge",
    "content_inscription_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbi0"
  }
}
```

### E8 — External `link` to a 3D asset

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "link",
  "chain": "dogecoin",
  "of": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0",
  "hrefs": [
    { "rel": "3d", "uri": "ipfs://bafybeigdyrzt5exampledogemap3dasset" },
    { "rel": "preview", "uri": "https://example.invalid/dogemaps/0.png" }
  ]
}
```

### E9 — `params` is not an op (ignored)

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "params",
  "chain": "dogecoin",
  "params": { "H3_RES": 8 }
}
```

Since 0.2 there is no `params` op (§6.4). Indexers ignore this body; `H3_RES` stays 9.

### E10 — ÐMP `list` for a claim inscription

```json
{
  "p": "dmp",
  "v": "1.0",
  "op": "list",
  "inscription_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0",
  "price": "10000000000",
  "currency": "DOGE",
  "seller": "D8mZsgKwmSQWYRPEMCcm8KzNFj1JVF5UpA",
  "chain": "dogecoin",
  "ts": 1700000000
}
```

### E11 — ÐMP dynamic collection for all ÐMaps titles

```json
{
  "p": "dmp",
  "v": "1.0",
  "op": "collection",
  "slug": "dogemaps-v1",
  "name": "ÐMaps v1 — Block Titles",
  "creator_address": "D8mZsgKwmSQWYRPEMCcm8KzNFj1JVF5UpA",
  "type": "dynamic",
  "criteria": {
    "mode": "rule_based",
    "rule": { "p": "Ð:MAPS", "op": "claim", "title.tier": "standard" }
  },
  "dogenals": {
    "title_protocol": "dogemaps",
    "protocol_version": "1",
    "supply_model": "per_block"
  },
  "chain": "dogecoin",
  "ts": 1700000000
}
```

### E12 — Reorg behavior (indexer scenario)

```json
{
  "scenario": "reorg",
  "protocol": "dogemaps",
  "block_height": 5000000,
  "old_best_chain_winner": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0",
  "new_best_chain_winner": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccci0",
  "rule": "rollback to common ancestor, clear affected title state, replay canonical order"
}
```

### E13 — Legacy OG Dogemap label (not a v1 claim)

```json
{
  "legacy": "dogemaps-og",
  "inscription_id": "ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddi0",
  "claimed_block_height": 42,
  "label": "OG (legacy)",
  "canonical_v1_title": "not set by this object"
}
```

---

## 16. Comparison: Bitcoin Bitmaps and prior community dogemaps

| Dimension | Bitcoin **Bitmaps** (community) | **ÐMaps (this spec v1)** |
| --- | --- | --- |
| Chain | Bitcoin | **Dogecoin** |
| Title / association | **Block** / ordinal-space (ecosystem-specific) | **`block_height` (normative) +** derived **H3** |
| Geo | Not normative in many Bitmap docs | **H3** at `H3_RES` with **MUST** verify |
| Fairness levers | Social, miner, external | **MUST** activity-based stake floor and **MUST** OP_RETURN burn of the stake |
| Marketplace | Varies by platform | **Normative** ÐMP for listings / transfers; **Dogenals** extension for supply metadata |
| On-chain build | Varies; community layers | **`upgrade`**, `link` **normative**; parent-child encouraged |
| Legacy / OG | n/a in same form | **OG** labeled; **MUST** not displace a **v1** `claim` |
| Canonical ordering | Often indexer/community convention | Explicit `block_height`, `tx_index`, `vout`, inscription order |
| Infinite supply | Bitcoin block cadence | Dogecoin block cadence; represented in ÐMP as dynamic / `per_block` |
| Anti-monopoly stance | Collection / market policy dependent | Burned stake that rises with activity, duplicate invalidation |
| Legal geography | Usually not a legal claim | H3 is explicitly **not** real-world property law |

*Informative: “**Current** community dogemaps / `.dogemap` labels” (before this spec) **MAY** be inconsistent. **v1** is the
interoperable **Dogenals** / indexer standard. **OG** items remain visible as **cultural** artifacts only.*

---

## 17. Visual Renderer Extension (v1)

This extension is **recommended** for explorers, wallets, and galleries that want a **deterministic**, reproducible
visual for a parcel without hosting bespoke artwork. It is **optional**; indexers and UIs **MAY** omit it.

A **parcel** is the canonical title for `( chain_id, block_height, "standard" )` (§5–§8). The visual is a **fixed**
square raster of **N × N** tiles with **N = 32** (1024 tiles), sRGB, 8 bits per channel. Implementations **MUST
NOT** use non-deterministic sources (no `Math.random()`, wall-clock entropy, device noise, or nondeterministic
GPU paths) when claiming conformance to this extension.

### 17.1 Indexed inputs (SHOULD)

Indexers **SHOULD** expose integer counters used only for modulation (not for palette or walk selection):

- **`drc20_ops`:** Count of **DRC-20** protocol operations (as classified by the indexer’s DRC-20 rules) that
  **reference** the parcel’s canonical **`claim` `inscription_id`** in a normative reference field (for example a
  `dogemap`, `parcel`, or `title` pointer) **or** appear in the same spending graph edge documented by the
  indexer. Counting rules **MUST** be versioned in indexer documentation so third parties can reproduce totals.

- **`doginal_utxos`:** Count of distinct **Dogenals inscription UTXOs** that the indexer considers **linked** to
  the parcel’s canonical `claim` through **valid** `Ð:MAPS` `link` / `upgrade` ancestry (§6.2–§6.3), plus any
  additional **documented** `link.rel` classes that imply attachment. Double-counting **MUST** be avoided.

**Parcel activity (extension-local, MUST for this extension’s modulation):**

```text
activity = (drc20_ops × 3) + (doginal_utxos × 2)
```

If a field is unknown, implementations **MUST** treat it as `0` for modulation (and **SHOULD** label the output
as **partial** in APIs).

### 17.2 Pattern digest (block height only)

Let `decimal(n)` be as in §7.2. Define:

```text
PATTERN_MSG = UTF-8( "DOGEMAPS/1/VISUAL_EXT/v=1/pattern/block_height=" || decimal(block_height) || "/" )
pattern_digest = SHA256( SHA256( PATTERN_MSG ) )
```

- **`palette_id`:** `read_uint32_be(pattern_digest, 0) mod 8`
- **`walk_id`:** `read_uint32_be(pattern_digest, 4) mod 4`

`read_uint32_be(d, k)` is big-endian **unsigned** 32 bits from byte offset `k`.

### 17.3 Palettes (MUST)

sRGB 8-bit tuples `(R, G, B)` for **`base`** and **`accent`**:

| `palette_id` | `base` | `accent` |
| --- | --- | --- |
| 0 | (255, 107, 107) | (78, 205, 196) |
| 1 | (69, 183, 209) | (255, 160, 122) |
| 2 | (152, 216, 200) | (247, 220, 111) |
| 3 | (187, 143, 206) | (133, 193, 233) |
| 4 | (248, 196, 113) | (130, 224, 170) |
| 5 | (241, 148, 138) | (133, 193, 233) |
| 6 | (174, 214, 241) | (250, 215, 160) |
| 7 | (215, 189, 226) | (169, 223, 191) |

### 17.4 Walk order (MUST)

Let `t` range `0 .. 1023` in order. Map `t` to `(x, y)` with `x` column `0..31`, `y` row `0..31`:

- **`walk_id = 0` (row-major):** `x = t mod 32`, `y = floor(t / 32)`.
- **`walk_id = 1` (column-major):** `y = t mod 32`, `x = floor(t / 32)`.
- **`walk_id = 2` (diagonal):** Enumerate all `(x, y)` in ascending `s = x + y`, breaking ties by ascending `x`.
  The `t`-th emitted pair is the coordinate for step `t`.
- **`walk_id = 3` (spiral, clockwise from the top-left):** Trace the perimeter
  `(top, left) → (top, right)`, then `(top+1, right) → (bottom, right)`, then `(bottom, right-1) → (bottom, left)`,
  then `(bottom-1, left) → (top+1, left)`, shrinking the bounds after each side until all cells are visited.

### 17.5 Tile mixing parameter (MUST)

For each `t`, let `(x, y) = WALK(walk_id, t)` per §17.4.

```text
TILE_MSG = UTF-8( "DOGEMAPS/1/VISUAL_EXT/v=1/tile/block_height=" || decimal(block_height)
            || "/x=" || decimal(x) || "/y=" || decimal(y) || "/walk=" || decimal(walk_id) || "/" )
tile_digest = SHA256( SHA256( TILE_MSG ) )
lam = ( (tile_digest[0] << 16) | (tile_digest[1] << 8) | tile_digest[2] ) / 16777215
```

`lam` is a **float64** in `[0, 1]` inclusive (endpoints achievable). `tile_digest[k]` is byte `k` of the digest.

### 17.6 Activity modulation (MUST)

Let `activity_cap = min(activity, 1_000_000)`. Define **float64**:

```text
activity_unit = activity_cap / (activity_cap + 1000)
```

If `activity_cap = 0`, **`activity_unit = 0`**.

Then:

```text
density       = 0.3 + 0.7 * activity_unit
contrast      = 0.5 + 0.5 * activity_unit
accent_strength = activity_unit
```

### 17.7 Per-channel color (MUST)

For each channel `c ∈ {R, G, B}` independently, let `base_c` and `accent_c` be the palette components
(0–255 integers) for `palette_id`. Compute **float64** values in `[0, 1]`:

```text
base01   = base_c / 255
accent01 = accent_c / 255
mix01    = base01 + (accent01 - base01) * lam
mix01    = 0.5 + (mix01 - 0.5) * contrast
gray     = 0.5
mix01    = mix01 * density + gray * (1 - density)
mix01    = mix01 + (accent01 - mix01) * (accent_strength * lam)
out_c    = floor( clamp( mix01, 0, 1 ) * 255 + 0.5 )
```

`clamp` clamps to `[0, 1]`. `floor(x + 0.5)` is **round half up** on nonnegative values. The tile sRGB triple is
`(out_R, out_G, out_B)`.

Implementations **MUST** use **IEEE-754 binary64** for intermediates. **Reference test vectors** (tile `t = 0`):

| `block_height` | `activity` | sRGB (tile 0) |
| --- | --- | --- |
| 0 | 0 | (125, 137, 135) |
| 0 | 5000 | (89, 196, 188) |
| 1 | 0 | (141, 132, 132) |
| 12345 | 0 | (145, 125, 125) |

### 17.8 Scaling and export (SHOULD)

Implementations **MAY** upscale tiles with **nearest-neighbor** only if they document scale factors; filtered
upscaling is **not** part of the normative tile values.

### 17.9 Trust and deep links (informative)

- **Deep links:** UIs **MAY** use `?parcel=<block_height>` (decimal) to open a parcel view that renders this
  extension from indexer-supplied fields.
- **Optional reveal attestation:** See §18.4 for a normative on-chain **reveal marker** that collectors **MAY**
  use alongside marketplace provenance; renders **MUST NOT** treat reveals as legal or ownership claims.

---

## 18. Collector Scoring & Ranking Extension (v1)

This extension is **recommended** for leaderboards, collection UIs, and analytics. It is **optional** and **does
not** change ÐMaps title validity (§5–§8).

### 18.1 Indexed activity (MUST)

Use the same **`drc20_ops`** and **`doginal_utxos`** definitions as §17.1 (or a strict subset documented by the
indexer). **MUST:**

```text
activity = (drc20_ops × 3) + (doginal_utxos × 2)
```

All public leaderboard fields **MUST** cite the indexer rule version used to produce the counts.

### 18.2 Era index (MUST)

```text
era_index = floor( block_height / 100_000 ) + 1
```

(`100_000` is one hundred thousand; `era_index` starts at `1` for genesis through height `99_999`.)

### 18.3 Era boost (MUST)

To keep early-chain parcels from being dominated only by later activity accumulation, apply a **bounded** era
bonus:

```text
era_boost = max( 0, min( 12, 13 - era_index ) )
```

Examples: `era_index = 1 → 12`; `era_index = 12 → 1`; `era_index ≥ 13 → 0`.

### 18.4 Reveal boost (MUST)

`reveal_boost = 5` iff **any** of the following holds on the **best chain** at the indexer’s tip; otherwise
`0`:

1. **Link reveal:** A **valid** `op: "link"` (§6.3) in the ÐMaps graph references the parcel’s canonical
   **`claim` `inscription_id`** (directly or per the indexer’s documented hop rules) and includes an `hrefs`
   entry with **`"rel": "reveal"`** (exact string).
2. **Reveal transaction:** A confirmed transaction contains an `OP_RETURN` payload (after the `OP_RETURN`
   opcode and its push) whose bytes equal **`UTF-8("DOGEMAPS1REVEAL")` immediately followed by** the parcel’s
   canonical **`inscription_id` encoding** (`64` lowercase hex + `i` + decimal `vout`, no spaces).

Indexers **SHOULD** store the **first** such txid as `reveal_txid` for auditability.

### 18.5 Score (MUST)

Let `ln` be the **natural logarithm** on **IEEE-754 binary64**. Let `round_even` round to the nearest integer,
ties to even. Define:

```text
raw = ln(1 + activity) * 20 + era_boost + reveal_boost
score = max( 0, min( 100, round_even( raw ) ) )
```

`activity` is a nonnegative integer; `ln(1 + activity)` uses the promoted **float64** value.

### 18.6 Era rankings for revealed parcels (MUST)

Let the **revealed set** for an era be parcels whose **`reveal_boost = 5`** (§18.4) and whose `block_height` maps
to that **`era_index`**. Ignore parcels with no canonical claim.

**Sort key (lexicographic, descending):**

1. `activity`
2. `block_height`

**Rank** `1` is the first entry (highest activity; higher `block_height` breaks ties).

Let `total` be the count of revealed parcels in the era. The **era position fraction** (informative “top
percent”) is:

```text
era_top_pct = round( 100 * rank / total, 2 )
```

using **round half away from zero** at two decimal places, with `era_top_pct = 0` when `total = 0`. **Lower**
`era_top_pct` indicates a **stronger** position for a given `rank` (rank `1` ⇒ minimal fraction).

### 18.7 Verification (MUST)

Any published `score`, `rank`, or `era_top_pct` **MUST** be reproducible from:

- `block_height`, canonical **`inscription_id`**, `drc20_ops`, `doginal_utxos`, `era_index`, and the boolean
  reveal predicates in §18.4.

Third parties **MUST** be able to recompute **without** proprietary oracle data.

---

## 19. Future extensions

v2 proposals (multi-tier titles, alternate H3 policies, richer activity graphs, privacy-preserving proofs) are
welcome via public review. Changes **SHOULD** preserve **FCFS** canonical ordering, **H3** recomputation from
`block_height`, **anti-hoarding** friction, **pure Dogenals** payloads, and **reorg-safe** replay semantics. This
section is intentionally short; the goal is composability with marketplace (`ÐMP`), metadata (`ÐMS`), ÐLand expansion packs, and indexer
ecosystems without central gatekeepers.

**ÐLand (`p: "Ð:LAND"`):** The companion expansion-pack, holder-gated build, and *chosen* real-world anchor layer lives in [../dland/spec.md](../dland/spec.md). ÐLand is a **Launch Draft**. It MUST NOT mint, override, or displace a ÐMaps v1 claim. See also [../../docs/INDEXING.md](../../docs/INDEXING.md).


**Celestial titles / globe overlay (informative):** Product maps MAY draw ÐMaps cells as a **layer** on the ÐGPS globe (Earth today; Moon/Mars if this protocol later adds `body` on `Ð:MAPS`). That overlay is not a new marker. Do **not** introduce `Ð:EARTH` / `Ð:MOON` sibling protocols — extend `Ð:MAPS` and `Ð:GPS` in place.

---

## 20. Changelog

- **0.2** — Strict JSON profile (INDEXING §2.2) and an 8192-byte limit; `claim` must be `i0` and whole in one
  transaction; `chain` is `"dogecoin"` everywhere; `h3_res` fixed at 9; `params` op, per-address caps and
  burst limits removed; integer stake floor `10 × (1000 + min(G, 5000))²` with `G` = titles in the previous
  2016 blocks; the stake must be burned to an exact `DDMAPBURN` OP_RETURN output (fee-as-stake removed);
  top-level aliases (`block`, `h3`, …) are not read.
- **0.1** — Launch draft.

---

*Dogenals protocol. H3: Uber (Apache-2.0) applies to the **H3 library**; this document is MIT under the
repository [LICENSE](../../LICENSE) unless otherwise noted.*
