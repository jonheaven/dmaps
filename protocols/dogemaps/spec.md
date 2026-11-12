<!-- markdownlint-disable MD024 -->
# ÐMaps — Block Title and Geo-Overlay Protocol (Dogenals)

Version: 0.1
Status: Launch Draft
Canonical public repo: [github.com/jonheaven/dmaps](https://github.com/jonheaven/dmaps)
Indexing (deterministic, shared with ÐLand): [docs/INDEXING.md](../../docs/INDEXING.md)

Chain: Dogecoin (mainnet; `chain: "dogecoin"`. Regtest or testnet MAY set `chain` to an implementation-defined value when documented.)

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
   - 6.4 params (optional governance)
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

- **Fair** — FCFS with transparent economic friction (stake floors, claim caps, activity-weighted scoring) applies identically to every participant. The origin of a valid inscription — whether self-mined or purchased from any marketplace — confers neither privilege nor penalty at the protocol layer.

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

- Parsers **SHOULD** treat payloads with UTF-8 JSON size **greater than 8 KB** as `invalid` for the ÐMaps
  protocol (interoperability; not consensus).
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
- `op`: one of `claim` | `upgrade` | `link` | `params`
- `chain`: `dogecoin` (mainnet)

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

- **New `claim`, `upgrade`, `link`, and `params` inscriptions** **SHOULD** use the **`dog`** witness envelope
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

- `title.block_height` **MUST** be a non-negative **JSON number** (integer) with no fraction.
- **Maturity (anti time-travel):** Let `H` = confirmation **block height** of the `claim` inscription. Indexers
  **MUST** require `title.block_height ≤ H`.
- `title.tier` **MUST** be the string `standard` in v1. Other values are **MUST** `invalid` until a future
  version of this spec defines them.
- `geo.h3_res` **MUST** equal the active `H3_RES` for the indexer at height `H` (from the latest **valid** prior
  `params` in §6.4, or default 9 if none).
- `geo.h3_cell` **MUST** equal the **exact** string from `DOGEMAPS_H3( title.block_height, geo.h3_res )` in §7.
- `fair.stake_koinu` **MUST** be a **decimal string of koinu** (no sign, no leading zero except the single
  `0` for zero), matching [ÐMP numeric strings](https://github.com/jonheaven/dmp/blob/main/spec.md).
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

### 6.4 `params` — Global H3 and fee constants (optional)

Optional **governance** op. Minimal reference indexers in v1 **MAY** ignore it if they use **fixed** defaults.
If implemented:

- **MUST** be signed (Dogecoin signed message or BIP-322) by a public key that was **registered** in a
  previous `params` (bootstrap key **MAY** be a **well-known** constant in the first release, documented in
  **implementation notes** — or omitted so all indexers use static defaults). **MUST** define signature
  canonicalization in the `params` extension document.

- Fields: `H3_RES`, `BASE` koinu, rolling window `R` blocks, caps, etc. Unknown keys **MUST** be **ignored**

If `params` is not implemented, the defaults in **§7** and **§9** apply to all indexers (recommended for
first implementations).

---

## 7. H3 Geospatial Derivation

**Reference:** H3, Uber (Apache-2.0) — [https://github.com/uber/h3](https://github.com/uber/h3) — v4 **API** as
stabilized in each language port.

**MUST (library):** Implementers **MUST** use a conforming H3 4.x `latLngToCell` (or `geoToH3` binding) for the
**resolution** `H3_RES`.

### 7.1 Default resolution

- `H3_RES` = **9** (unless a valid on-chain `params` changes it, if supported).

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

Economic and rate rules are **MUST** for a **conforming** indexer in v1. They are **enforced in transaction
structure and stake floors**, not by consensus. Network policy **MUST** be the same for interop: pick **one**
stake model from §9.3 in deployments.

### 9.1 Rolling per-address `claim` limit

- `R` = 2016 blocks.
- `A` = number of ÐMaps protocol inscriptions (any `op` from this **claimer** address) seen in the last `R` blocks
  in the **best** chain, including the current transaction if applicable. (Implementations **MAY** only
  count `claim` for a simpler upper bound, but that **MUST** be **documented**.)
- **MUST (cap):** A `claim` is **valid** only if `A ≤ A_cap` where
  - `A_cap = min( 12, 4 + floor( current_height / 100_000 ) )`  
  (Slow ramp with time; monopolist throughput is bounded in the long run.)

### 9.2 Global **floor** stake (activity-based ramp)

- `G` = number of `claim` ops **confirmed in the best chain** in the previous 2016 blocks (not including the
  current block until confirmed).
- `activity = min(1.0, G / 5000.0)`.
- `min_stake_floor = round_koinu( 10_000_000 * (1.0 + 5.0 * activity)^2 )`  
  ( `10_000_000` = 0.1 **DOGE** in koinu. `round_koinu` = round to **nearest** integer, ties to even.)

### 9.3 Stake attestation in the **claim transaction** (MUST, pick one policy per network)

The **inscribing** transaction of the `claim` **MUST** include an `OP_RETURN` output (first or additional
`OP_RETURN` in the same tx) whose payload, after a single `OP_RETURN` opcode and push, begins with the
bytes:

`DDMAPBURN`

followed by **8 little-endian** bytes: unsigned 64-bit integer equal to the integer value of
`parse(fair.stake_koinu)`.

**MUST (stake satisfaction):** At least one of the following (deployment picks **one** and all indexers for
that deployment **MUST** align):

1. **Fee-as-stake (simple):** The **implicit fee** to miners in this transaction (sum inputs − sum non-fee
   outputs) **MUST** be `≥ parse(fair.stake_koinu)`.
2. **Explicit burn:** An output of value `≥ parse(fair.stake_koinu)` to a **provably unspendable** script, as
   documented in the project’s `SECURITY.md` / burn table.

`fair.stake_koinu` **MUST** be `≥ max( min_stake_floor, 1_000_000 )` in koinu, and in v1 with policy (1) also
`fee ≥ that same number`.

### 9.4 Burst (SHOULD, indexer heuristic)

- In addition, indexers **SHOULD** mark as `invalid` more than **2** `claim` ops from the **same** address in
  any **rolling 1440-block** window (independent of 9.1) if those claims would exceed social tolerance.
  (Optional; if implemented, **MUST** be documented in `indexer.yml`.)

### 9.5 Sybil

- UTXO-level Sybil is inherent. The combination of §9.1–9.3 **MUST** raise the cost of mass monopolies; users
  **MUST** treat “same-day hundreds of claims from fresh wallets” with suspicion in marketplaces.

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
- **Griefing:** Stake and caps reduce empty claims; not eliminated.
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
    if j.chain != "dogecoin" and is_mainnet_deployment: invalid; continue
    if j.op == "params": optional_apply_signed_params( j, b ) ; continue
    if j.op == "claim":
       if not claim_schema_ok( j ): continue
       if j.title.block_height > b.height: invalid; continue
       if recompute( j ) != j.geo.h3_cell: invalid; continue
       if not fair_ok( j, b, ins ): invalid; continue
       key = (j.chain, j.title.block_height, "standard")
       if key in state: duplicate; continue
       if j.title.tier != "standard": invalid; continue
       state[key] = ins.inscription_id
    // upgrade, link: validate graph rules; optional indexes
reorg: rollback and rerun from common ancestor
```

---

## 15. Operation Examples (at least 10)

All JSON is illustrative. `h3_cell` values are placeholders; indexers **MUST** recompute them with
`DOGEMAPS_H3(block_height, h3_res)` and reject mismatches.

### E1 — Claim genesis block 0

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "claim",
  "chain": "dogecoin",
  "title": { "block_height": 0, "tier": "standard" },
  "geo": { "h3_res": 9, "h3_cell": "<recomputed>" },
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
  "geo": { "h3_res": 9, "h3_cell": "<recomputed>" },
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
  "geo": { "h3_res": 9, "h3_cell": "<recomputed>" },
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

If `8928308280fffff` is not the exact recomputed cell for `(12345, 9)`, this **MUST** be invalid.

### E5 — Time-travel claim (invalid)

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "claim",
  "chain": "dogecoin",
  "title": { "block_height": 999999999, "tier": "standard" },
  "geo": { "h3_res": 9, "h3_cell": "<recomputed>" },
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
  "geo": { "h3_res": 9, "h3_cell": "<recomputed>" },
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

### E9 — Signed `params` update for H3 resolution

```json
{
  "p": "Ð:MAPS",
  "v": "1",
  "op": "params",
  "chain": "dogecoin",
  "effective_height": 7000000,
  "params": { "H3_RES": 8, "BASE": "10000000", "R": 2016 },
  "authority": "D8mZsgKwmSQWYRPEMCcm8KzNFj1JVF5UpA",
  "sig": "3045022100abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd02201234567890123456789012345678901234567890123456789012345678901234"
}
```

Indexers that do not implement signed `params` **MUST** ignore this operation and continue with default `H3_RES = 9`.

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
| Fairness levers | Social, miner, external | **MUST** caps + **MUST** stake floor and **MUST** burn/fee attestation (policy choice) |
| Marketplace | Varies by platform | **Normative** ÐMP for listings / transfers; **Dogenals** extension for supply metadata |
| On-chain build | Varies; community layers | **`upgrade`**, `link` **normative**; parent-child encouraged |
| Legacy / OG | n/a in same form | **OG** labeled; **MUST** not displace a **v1** `claim` |
| Canonical ordering | Often indexer/community convention | Explicit `block_height`, `tx_index`, `vout`, inscription order |
| Infinite supply | Bitcoin block cadence | Dogecoin block cadence; represented in ÐMP as dynamic / `per_block` |
| Anti-monopoly stance | Collection / market policy dependent | Protocol-level caps, stake friction, burst heuristics, duplicate invalidation |
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

*Dogenals protocol. H3: Uber (Apache-2.0) applies to the **H3 library**; this document is MIT under the
repository [LICENSE](../../LICENSE) unless otherwise noted.*
