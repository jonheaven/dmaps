/**
 * dogemap-mondrian/1 — the canonical 2D picture of a Dogecoin block (NON-CONSENSUS).
 *
 * A block's transactions become squares, in block order, sized by each transaction's
 * total output value on a log10 scale and packed with the Mondrian slot packer that
 * Bitcoin Bitmap renderers use (ordinals-wallet/bitmap-renderer, ported from bitfeed's
 * TxMondrianPoolScene). Same input, same picture, on every wallet and marketplace.
 *
 * Nothing here decides who holds a title or where a parcel is pinned. Spec:
 * docs/extensions/block-mondrian.md. Pure ESM, no dependencies, integer arithmetic only.
 */

export const MONDRIAN_VERSION = 'dogemap-mondrian/1';
export const MONDRIAN_COLORS = Object.freeze({ background: '#000000', square: '#C2A633' });

/**
 * Square side (grid units) for a transaction whose outputs total `koinu`:
 * `ceil(log10(koinu)) - 5`, at least 1 — bitmap-renderer's rule, computed exactly.
 * For k > 1, ceil(log10(k)) is the number of decimal digits of k - 1.
 */
export function txSquareSize(koinu) {
  const k = toKoinu(koinu);
  if (k <= 100000n) return 1;
  const digits = (k - 1n).toString().length;
  return Math.max(1, digits - 5);
}

function toKoinu(v) {
  if (typeof v === 'bigint') {
    if (v < 0n) throw new Error('koinu must be >= 0');
    return v;
  }
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v) || v < 0) throw new Error('koinu must be a non-negative safe integer (use a string or bigint for large values)');
    return BigInt(v);
  }
  if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
  throw new Error('koinu must be a non-negative integer');
}

/** Exact koinu from a decimal DOGE string such as "10000.00000000" (no floats). */
export function koinuFromDoge(text) {
  const m = /^(\d+)(?:\.(\d{0,8}))?$/.exec(String(text).trim());
  if (!m) throw new Error('not a decimal DOGE amount with at most 8 decimals');
  return BigInt(m[1]) * 100000000n + BigInt((m[2] ?? '').padEnd(8, '0') || '0');
}

// ---------------------------------------------------------------------------
// Mondrian slot packer: a line-for-line port of bitmap-renderer's MondrianLayout.

class Row {
  constructor() {
    this.slots = []; // sorted by x: { x, y, r }
  }
  idx(x) {
    return this.slots.findIndex((s) => s.x === x);
  }
  has(x) {
    return this.idx(x) >= 0;
  }
  add(slot) {
    if (slot.r === 0) return;
    const i = this.idx(slot.x);
    if (i >= 0) {
      if (slot.r > this.slots[i].r) this.slots[i].r = slot.r;
      return;
    }
    let pos = this.slots.findIndex((s) => s.x > slot.x);
    if (pos < 0) pos = this.slots.length;
    this.slots.splice(pos, 0, { ...slot });
  }
  remove(x) {
    const i = this.idx(x);
    if (i >= 0) this.slots.splice(i, 1);
  }
}

const sub = (a, b) => (a > b ? a - b : 0); // Rust saturating_sub on usize

class Layout {
  constructor(width) {
    this.width = width;
    this.rows = [];
  }
  exists(y) {
    return y < this.rows.length;
  }
  addRow() {
    this.rows.push(new Row());
    return this.rows.length - 1;
  }
  fill(slotX, slotY, slotR, size) {
    const sqRight = slotX + size;
    const sqTop = slotY + size;
    if (this.exists(slotY)) this.rows[slotY].remove(slotX);
    for (let rowY = slotY; rowY < sqTop; rowY += 1) {
      if (this.exists(rowY)) {
        const row = this.rows[rowY];
        const collisions = [];
        let maxExcess = 0;
        for (const s of row.slots) {
          const sRight = s.x + s.r;
          if (!(sRight <= slotX || s.x >= sqRight)) {
            collisions.push(s.x);
            maxExcess = Math.max(maxExcess, sub(sRight, slotX + slotR));
          }
        }
        const rhsR = sub(slotR, size) + maxExcess;
        if (sqRight < this.width && !row.has(sqRight) && rhsR > 0) row.add({ x: sqRight, y: rowY, r: rhsR });
        for (const cx of collisions) {
          const newR = sub(slotX, cx);
          if (newR > 0) {
            const i = row.idx(cx);
            if (i >= 0) row.slots[i].r = newR;
          } else {
            row.remove(cx);
          }
        }
      } else {
        this.addRow();
        if (slotX > 0) this.rows[rowY].add({ x: 0, y: rowY, r: slotX });
        if (sqRight < this.width) this.rows[rowY].add({ x: sqRight, y: rowY, r: this.width - sqRight });
      }
    }
    for (let rowY = sub(slotY, size); rowY < slotY; rowY += 1) {
      if (!this.exists(rowY)) continue;
      const adjust = [];
      for (const s of this.rows[rowY].slots) {
        if (s.x < sqRight && s.x + s.r > slotX && s.y + s.r >= slotY) adjust.push([s.x, s.r]);
      }
      for (const [sx, oldR] of adjust) {
        const newR = sub(slotY, rowY);
        if (newR > 0) {
          const i = this.rows[rowY].idx(sx);
          if (i >= 0) this.rows[rowY].slots[i].r = newR;
          let remX = sx + newR;
          let remY = rowY;
          let remW = sub(oldR, newR);
          let remH = newR;
          while (remW > 0 && remH > 0) {
            while (!this.exists(remY)) this.addRow();
            if (remW <= remH) {
              this.rows[remY].add({ x: remX, y: remY, r: remW });
              remY += remW;
              remH = sub(remH, remW);
            } else {
              this.rows[remY].add({ x: remX, y: remY, r: remH });
              remX += remH;
              remW = sub(remW, remH);
            }
          }
        } else {
          this.rows[rowY].remove(sx);
        }
      }
    }
    return { x: slotX, y: slotY, r: size };
  }
  place(size) {
    for (let y = 0; y < this.rows.length; y += 1) {
      const s = this.rows[y].slots.find((slot) => slot.r >= size);
      if (s) return this.fill(s.x, s.y, s.r, size);
    }
    const y = this.addRow();
    this.rows[y].add({ x: 0, y, r: this.width });
    return this.fill(0, y, this.width, size);
  }
}

function isqrtCeil(n) {
  if (n <= 1) return 1;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r -= 1;
  while (r * r < n) r += 1;
  return r;
}

/**
 * Layout for a block: `txValues` is each transaction's total output value in koinu,
 * in block order (coinbase first). Returns grid-unit squares in the same order.
 */
export function mondrianLayout(txValues) {
  const sizes = Array.from(txValues ?? [], txSquareSize);
  const area = sizes.reduce((n, s) => n + s * s, 0);
  const width = isqrtCeil(area);
  const layout = new Layout(width);
  const squares = sizes.map((s) => layout.place(s));
  if (!squares.length) squares.push({ x: 0, y: 0, r: 1 });
  const contentW = Math.max(...squares.map((q) => q.x + q.r));
  const contentH = Math.max(...squares.map((q) => q.y + q.r));
  return { version: MONDRIAN_VERSION, width, contentW, contentH, squares };
}

/**
 * Canonical SVG. Coordinates are in quarter grid units so every number is an integer:
 * a cell is 4 units, a square of side r is drawn 4r - 2 wide (bitmap-renderer's
 * gridSize / 4 padding on each side), the picture is (4E - 2) units square where
 * E = max(contentW, contentH), centered horizontally and top-aligned. At 576 px this is
 * exactly bitmap-renderer's `gridSize = 576 / (E - 0.5)`.
 */
export function mondrianSvg(layout, opts = {}) {
  const colors = { ...MONDRIAN_COLORS, ...(opts.colors ?? {}) };
  const px = opts.size ?? 576;
  const E = Math.max(layout.contentW, layout.contentH);
  const S = 4 * E - 2;
  const ox = 2 * (E - layout.contentW);
  const rects = layout.squares
    .map((q) => `<rect x="${ox + 4 * q.x}" y="${4 * q.y}" width="${4 * q.r - 2}" height="${4 * q.r - 2}"/>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${px}" height="${px}" shape-rendering="crispEdges">` +
    `<rect width="${S}" height="${S}" fill="${colors.background}"/>` +
    `<g fill="${colors.square}">${rects}</g></svg>`
  );
}

/** One call: block tx values (koinu, block order) to the canonical SVG. */
export function renderBlockSvg(txValues, opts) {
  return mondrianSvg(mondrianLayout(txValues), opts);
}
