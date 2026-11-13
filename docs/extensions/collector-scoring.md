# ÐMaps extension: collector scoring and ranking (v1)

**Optional, non-consensus.** Moved out of the ÐMaps core spec in 0.3 so the title rules fit on one page. Nothing here changes who holds a title, and no indexer has to implement it. Section numbers keep their old `§18.x` labels so existing links and implementations still line up. "Title" below means the canonical ÐMaps title for a block height ([../../protocols/dogemaps/spec.md](../../protocols/dogemaps/spec.md)).


This extension is **recommended** for leaderboards, collection UIs, and analytics. It is **optional** and **does
not** change ÐMaps title validity.

### 18.1 Indexed activity (MUST)

Use the same **`drc20_ops`** and **`doginal_utxos`** definitions as [visual-renderer.md](visual-renderer.md) §17.1 (or a strict subset documented by the
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

1. **Build reveal:** The parcel has a live ÐLand build whose content has a top-level `"reveal": true`
   (exact JSON boolean). (Before 0.3 this was a `Ð:MAPS` `link` with `rel: "reveal"`; indexers MAY keep counting
   legacy links.)
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
