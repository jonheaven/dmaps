# ÐMaps extension: visual renderer (v1)

**Optional, non-consensus.** Moved out of the ÐMaps core spec in 0.3 so the title rules fit on one page. Nothing here changes who holds a title, and no indexer has to implement it. Section numbers keep their old `§17.x` labels so existing links and implementations still line up. "Title" below means the canonical ÐMaps title for a block height ([../../protocols/dogemaps/spec.md](../../protocols/dogemaps/spec.md)).


This extension is **recommended** for explorers, wallets, and galleries that want a **deterministic**, reproducible
visual for a parcel without hosting bespoke artwork. It is **optional**; indexers and UIs **MAY** omit it.

A **parcel** is the canonical title for a `block_height` (core spec §2). The visual is a **fixed**
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
  the parcel’s canonical title: inscriptions that are children of the title (Doginals parent/child), plus the
  parcel's live ÐLand build slots. The `Ð:MAPS` `upgrade`/`link` ops were removed in core 0.3; legacy ones MAY be
  counted if the indexer documents how. Double-counting **MUST** be avoided.

**Parcel activity (extension-local, MUST for this extension’s modulation):**

```text
activity = (drc20_ops × 3) + (doginal_utxos × 2)
```

If a field is unknown, implementations **MUST** treat it as `0` for modulation (and **SHOULD** label the output
as **partial** in APIs).

### 17.2 Pattern digest (block height only)

Let `decimal(n)` be as in core §4 (decimal digits, no leading zero). Define:

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
