# ÐMaps extension: block picture, `dogemap-mondrian/1`

**Optional, non-consensus.** This is how to draw a block as a picture, so every wallet, marketplace and explorer shows the same image for the same `<n>.dogemap`. It does not change who holds a title or where a parcel is pinned, and no indexer has to implement it. Reference code: [`reference/dogemap-mondrian.mjs`](../../reference/dogemap-mondrian.mjs), vectors in [`reference/dogemap-mondrian.test.mjs`](../../reference/dogemap-mondrian.test.mjs) (`npm test`).

This complements the [visual renderer](visual-renderer.md) (a 32 × 32 pattern derived from the height alone). The block picture is drawn from the block's own transactions.

## Convention adopted

Bitcoin Bitmap marketplaces draw a block as a "Mondrian": one square per transaction, sized by value, packed into a near-square grid. The open implementation is [ordinals-wallet/bitmap-renderer](https://github.com/ordinals-wallet/bitmap-renderer), whose packer is a port of [bitfeed](https://github.com/bitfeed-project/bitfeed)'s `TxMondrianPoolScene`. Its README reports pixel-level agreement with Magic Eden's reference images. `dogemap-mondrian/1` uses that packer and that size rule unchanged, so a Bitmap collector reads a dogemap the same way. Only the input unit (koinu), the palette and the export format are Dogecoin's.

## 1. Input

The ordered list of the block's transactions (coinbase first, block order). For each transaction, `value` is the sum of its output values in **koinu** (1 DOGE = 10^8 koinu), an exact integer. Producers SHOULD read it from the raw block (as Dogex's `GET /api/dmaps/block/{height}/tx-values` does), not from floating-point JSON.

## 2. Square size

```text
size(value) = 1                                if value <= 100000
            = max(1, ceil(log10(value)) - 5)   otherwise
```

Compute `ceil(log10(value))` exactly: for `value > 1` it is the number of decimal digits of `value - 1`. Examples: 1 DOGE (10^8) → 3; 50 DOGE → 5; a 10,000 DOGE coinbase (10^12) → 7. This is bitmap-renderer's `tx_size_by_value` with integer arithmetic instead of `f64`.

## 3. Packing

- `area = Σ size²`; grid width `W = ceil(sqrt(area))` (integer square root, at least 1).
- Place squares **in block order** with the Mondrian slot packer: rows of free slots `{x, y, r}` sorted by `x`. A square of size `s` goes in the first slot (scanning rows top to bottom, slots left to right) with `r >= s`; if none exists, a new row is opened with one slot of width `W`. Filling a slot splits and trims the neighbouring slots exactly as `MondrianLayout::fill_slot` in bitmap-renderer `src/lib.rs`. The reference JavaScript is a line-for-line port and is normative for this extension.
- Output: one `{x, y, r}` per transaction (grid units, origin top-left), `contentW = max(x + r)`, `contentH = max(y + r)`.

A block with no transactions (none exist on Dogecoin) draws one 1 × 1 square.

## 4. Export (canonical SVG)

Let `E = max(contentW, contentH)`. Coordinates are in quarter grid units, so every number is an integer:

```text
viewBox  = 0 0 S S        with S = 4E − 2
square   = x' = 2(E − contentW) + 4x,   y' = 4y,   width = height = 4r − 2
```

Content is centered horizontally and top-aligned, and each square leaves a half-cell gap, which is bitmap-renderer's `gridSize = 576 / (E − 0.5)` with `unitPadding = gridSize / 4`. Canonical colors: background `#000000`, squares `#C2A633` (Dogecoin gold). The canonical document is exactly:

```text
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 S S" width="576" height="576" shape-rendering="crispEdges"><rect width="S" height="S" fill="#000000"/><g fill="#C2A633"><rect x=".." y=".." width=".." height=".."/>…</g></svg>
```

with one `<rect>` per transaction in block order. Implementations MAY change the pixel size or colors for display. A picture that claims to be `dogemap-mondrian/1` keeps the layout and the viewBox.

## 5. Notes

- Deterministic: integer inputs, integer layout, no randomness, clock, or fonts.
- Shapes ("punks", grids) come from the block itself. Rarity labels are views, like the [collector scoring](collector-scoring.md) extension.
- Not consensus: no rule reads the picture, and it is not part of `dmaps-state/3`.
- Embedding: a host MAY serve `GET /…/{height}.svg` (doginals.lol serves `/api/dogemap-picture/{height}.svg`; embed it with `<img>`). It is immutable once the block is deep.
