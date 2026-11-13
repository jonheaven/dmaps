# Deterministic indexing (ÐMaps + ÐLand)

**Status:** Normative for any indexer that claims compatibility with this repository, including the reference implementation (Dogex). **Version 0.3.0** (`dmaps-state/3`). See [../changelog.md](../changelog.md).

Two independent indexers, given the same Dogecoin chain and this spec, **MUST** produce **identical** protocol state at every height, and **MUST** agree on the **state root** in §8 after every block. The rules apply from the first block: there are no protocol versions and no activation heights.

This is the document that makes a third-party indexer possible. Protocol payloads live in [../protocols/dogemaps/spec.md](../protocols/dogemaps/spec.md) and [../protocols/dland/spec.md](../protocols/dland/spec.md). This file pins *how* those payloads are folded into state. Where a protocol spec and this file disagree, this file wins.

Design rules: no trusted party, no off-chain input, no tunable parameter, no floating point in consensus (the derived H3 cell is display, not a rule), and every rule is a pure function of confirmed chain data. Every number in this file is an integer. The only conflict rule is **first wins**: the first inscription for a title, and the lowest commit-first key for a cell.

---

## 1. Constants

| Constant | Value |
| --- | --- |
| `COMMIT_WINDOW` (`W`) | `30` |
| `H3_VERSION` | Uber H3 **4.2.1** |
| `MAPS_H3_RES` | `9` |
| `H3_ANCHOR_RES` | `12` |
| `H3_DISTRICT_RES` | `7` |
| `H3_REGION_RES` | `4` |
| `MAPS_MAX_PAYLOAD` | `8192` bytes |
| `LAND_MAX_PAYLOAD` | `16384` bytes |
| `MAX_DEPTH` | `32` |

They are the same on every network. The network name (`dogecoin`, `testnet`, `regtest`) only seeds the genesis root (§8.4), so roots from different networks never collide.

There is no activation height, claim window, stake, cooldown or other tunable in the protocol. An indexer MAY start late or skip a protocol to save work (Dogex: `DOGEX_DOGEMAP_ACTIVATION_HEIGHT`, `DOGEX_LAND_ACTIVATION_HEIGHT`, off on mainnet by default); such an index is a partial one, and its roots match the canonical roots only if nothing it skipped was a claim or ÐLand op. ÐLand reads ÐMaps titles, so an indexer that applies ÐLand MUST also apply ÐMaps.

---

## 2. Carrier and body

### 2.1 Carrier

Only Doginals inscription payloads count. OP_RETURN-only JSON MUST be ignored by ÐMaps and ÐLand.

- **ÐMaps claim:** any inscription, at any index, in either envelope the indexer reads. A body that spans several transactions counts at the transaction that completes it. The content type MUST start with `text/plain` or `application/json` [`media_type`].
- **ÐLand `pack`:** any inscription. A pack body may span several transactions (large schemas); it applies at the transaction that completes the body.
- **ÐLand `build`, `anchor`:** the inscription MUST be `i0` and whole in one transaction, and MUST be **bound**: `vin[0].scriptSig` carries an `ord` envelope under the committed lock (committed-envelope §3), and the Doginals body that envelope binds is byte-identical to the inscription body. A `dog`-marker envelope is not a ÐLand carrier. An unbound `build` or `anchor` is **invalid**.

Only parcel changes need the strict carrier, because they are the only ops that can hurt someone else: the bound `vin[0]` envelope stops a relayer swapping the body, and `i0` removes any doubt about envelope order inside one transaction.

### 2.2 JSON profile (MUST)

Every ÐMaps JSON claim and every ÐLand body is read through one profile, so indexers built on different JSON libraries agree byte for byte. A body that breaks any rule is **not** a protocol op (it is ignored, not an error):

1. Size: at most the protocol's `MAX_PAYLOAD` bytes.
2. Strict UTF-8, no byte-order mark.
3. Exactly one JSON value (RFC 8259) and it is an object. JSON whitespace (`SP`, `HT`, `LF`, `CR`) around it is allowed; nothing else is trimmed.
4. Nesting depth at most `MAX_DEPTH` (the top-level object is depth 1).
5. Every number is an integer literal: no fraction, no exponent, no `-0`, and `|n| ≤ 2^53 − 1`.
6. No string or key contains a lone surrogate escape (for example `"\ud800"`).
7. No object repeats a key, compared after unescaping.
8. Types are strict. A field the spec gives a type MUST have that type; `null` is never a valid value for a named field (`"note": null` is a bad note, not a missing one). Keys the spec does not name are ignored.

Inscription ids in bodies are canonical: `^[0-9a-f]{64}i(0|[1-9][0-9]{0,9})$` with the index ≤ `2^32 − 1`. Uppercase hex or a leading zero in the index is a different (invalid) string, not the same id.

Content that is hashed or stored (pack schemas, build content) is stored as **RFC 8785 JCS** text: keys sorted by UTF-16 code units, strings escaped as ECMAScript `JSON.stringify` does, integers in shortest decimal form. The profile only admits integers, so JCS never needs floating-point formatting.

The reference profile is [../reference/json-profile.mjs](../reference/json-profile.mjs); the raw-profile vectors are `PROF-*` in [../protocols/dland/vectors/conformance.json](../protocols/dland/vectors/conformance.json).

---

## 3. Canonical inscription order (MUST)

Blocks are applied in height order, 0…tip, on the current best chain. Within a block, inscriptions are applied in transaction order (index in the block, ascending), and within a transaction in the Doginals inscription order. A body that spans transactions is applied at the transaction that completes it. That total order decides every "first": titles (§4), packs, and the commit-first fallback key for anchors (§5.4).

---

## 4. ÐMaps titles

A complete inscription body confirmed at height `h` is a **claim** for block `n` when (reference reason names in brackets):

1. Its content type starts with `text/plain` or `application/json` [`media_type`], and either
2. **text:** the body bytes end with `.dogemap` and are exactly `<n>.dogemap`, where `n` matches `0|[1-9][0-9]*` [`dogemap_text`] and has at most 10 digits [`time_travel`]; or
3. **JSON:** otherwise, the body passes the profile §2.2 with `MAPS_MAX_PAYLOAD` [`too_large`, profile reasons], `p == "Ð:MAPS"` [`p`], `op == "claim"` [`op`], `title` is an object [`title`], and `title.block_height` is an integer `0 ≤ n ≤ 2^32 − 1` [`block_height`];
4. and `n ≤ h` [`time_travel`].

No other key is read. `v`, `chain`, `tier`, `geo`, `fair`, `ts` and `note` in old JSON claims are ignored, right or wrong; the H3 cell is derived from `n` (ÐMaps §4), never read.

**First claim wins** block `n`, in canonical order (§3). Both forms share one slot: a later claim for the same `n`, in either form, is a **duplicate** and MUST NOT replace the title. This holds inside a block too.

- No stake, burn, claim window, `params` op, per-address cap, or alias. The inscription is the cost.
- Title transfers follow Doginals (§7). The title id never changes.

The reference parser is [../reference/dmaps-claim.mjs](../reference/dmaps-claim.mjs); vectors `CLAIM-*` and `geo_batch` are in [../protocols/dogemaps/vectors/conformance.json](../protocols/dogemaps/vectors/conformance.json).

**Compatibility note (informative).** The text rule is the one the existing dogemap index applies (exact `<n>.dogemap`, `text/plain`/`application/json` media type, first per `n`). Some indexers start that index at a later height or skip cursed inscriptions; ÐMaps has neither cut-off. Compare their titles before relying on a match below such a height.

---

## 5. ÐLand

Apply each ÐLand op in canonical order (§3), after the ÐMaps claims of earlier inscriptions. `v` is not read.

### 5.1 `pack`

Any inscription (any index, multi-transaction allowed). Profile §2.2 with `LAND_MAX_PAYLOAD`; fields as ÐLand §7. No holder authorization. Pack id = inscription id; a pack is written once. `name` is stored verbatim (not trimmed). The inline `schema`, if any, is stored as JCS text.

### 5.2 `build` and `anchor`: authorization

Invalid unless all of these hold, checked in this order (reason names in brackets):

1. The op is bound (§2.1) [`unbound`] and is `i0` [`not_vin0`].
2. A canonical ÐMaps title exists for `parcel` [`no_title`].
3. `title` in the body equals that title's inscription id [`title_mismatch`].
4. The title is not created in this same transaction, and the transaction **spends the title**: the title inscription is in the set of inscriptions carried by this transaction's inputs, taken **at the start of the transaction** (after all earlier transactions in the block) [`no_title_spend`].

The start-of-transaction spent set makes the check independent of the order an indexer walks inputs, outputs or inscriptions inside one transaction. Detached signatures are never authorization.

### 5.3 `build`

As ÐLand §8: the body needs `content`, `remove: true` or `seal: true` [`content`]; the pack MUST exist [`no_pack`]; a sealed slot accepts nothing more [`sealed`]. `remove` clears content; `content` replaces it; a `seal` without `content` **keeps** the live content. `seal_all` is not a field.

### 5.4 `anchor`

As ÐLand §9. `h3_res` MUST be `12` and `h3_cell` a canonical res-12 cell: 15 lowercase hex digits exactly as H3 `cellToString` prints them, and H3 `isValidCell` true (mode, reserved bits, base cell, pentagon deleted subsequence, and unused digits all checked).

- **Priority key:** `(height, tx_index, vout)` of the commit (ÐLand §9.2), lower wins.
- **Same cell:** anchoring to the cell the parcel already holds is `already_anchored` and changes nothing (the key is not refreshed).
- **Taking a cell:** a free cell is taken. An occupied cell (another parcel) is taken only when the occupant is still pending (`h ≤ occupant.height + W`) and the incoming key is strictly lower [`cell_taken`]. The **displaced** parcel is unanchored (its live cell becomes none).
- **Moving:** a parcel that takes a new cell releases its old one.
- **Clear:** `clear: true` releases the parcel's cell [`not_anchored` if it has none]. A released cell is free for the next op, even in the same block.
- **Finality:** an occupancy with key height `k` is final once `tip > k + W`; then nobody can displace it.

### 5.5 Districts and founders (derived)

Districts (`cellToParent(cell, 7)`) and regions (`cellToParent(cell, 4)`) are read off the live cells. The district **Founder** is the live cell in the district with the lowest priority key; `final` means that key is final at the tip. It is computed on read, is not a record, and no rule reads it. Nothing runs at the end of a block apart from §8.

---

## 6. Reorgs (MUST)

On a reorg that disconnects heights `h…old_tip`:

1. Undo state written at those heights, newest first.
2. Replay the new branch from the common ancestor, using the same rules as a first index.
3. Titles, packs, builds, cells, deltas and roots that existed only on the orphaned branch MUST disappear.
4. The state root after the common ancestor MUST equal what it was before the orphaned blocks were applied.

Per-block undo is cheap because state changes are already explicit: the delta of block `h` (§8.2) is exactly what must be undone. Dogex keeps a byte-level undo snapshot of every key it writes in a block, so a disconnect restores records, indexes, deltas and the root together. Other implementations MAY rebuild from genesis; the resulting root at each height MUST still match.

---

## 7. Transfers

Inscription transfers follow Doginals: spending the current satpoint moves the inscription to a new outpoint. The title *id* does not change. ÐLand live builds and the live anchor stay attached to the parcel. After a transfer, a previous holder's unconfirmed parcel-state op can no longer spend the title and is invalid if it confirms later (§5.2 rule 4). A transaction that both moves the title and carries a valid op is valid: the title was in its inputs at the start of the transaction.

---

## 8. State commitment (MUST)

### 8.1 Why there is a commitment

Two indexers need a cheap way to prove they hold the same state, and a reorg needs a cheap way to be checked. The root is an **audit commitment**: no rule reads it, and no op is valid or invalid because of it. Each block that changes state hashes only its own change (the delta) onto the previous root: O(change) per block, and nothing is written for a block that changes nothing. The full text (§8.5) is available on demand.

### 8.2 Records

Consensus state is a set of record lines. Each record has a **key** (its leading fields) and a **line**:

| Section | Key | Line |
| --- | --- | --- |
| Title | `T <block_height>` | `T <block_height> <inscription_id>` |
| Pack | `P <id>` | `P <id> <name_json> <version_json>` (RFC 8259 strings, as `JSON.stringify` writes them) |
| Build slot | `B <parcel> <pack_id>` | `B <parcel> <pack_id> <sealed 0\|1> <content_sha256\|none>` |
| Cell | `C <h3_cell>` | `C <h3_cell> <parcel> <key_height> <key_tx_index> <key_vout> <anchor_id>` |

- A build slot record exists only while it has live content or is sealed. `content_sha256` is the lowercase hex SHA-256 of the live content as JCS text (§2.2), or `none`.
- A parcel's live cell is the `C` record that names it (at most one).
- Numbers are decimal, no leading zeros.

**Order:** sections `T, P, B, C`; within `T` by the number; within `B` by parcel number then pack id; within `P` and `C` by the id or cell, bytewise.

Founders, standing scores, neighbor counts, build `applied` counts, whether a key came from a commit, explorer rows and any index structure are **not** records.

### 8.3 Delta

The delta of block `h` compares the records before and after the block, in record order:

- `+<line>` for a record that is new or whose line changed;
- `-<key>` for a record that was removed.

`delta_text(h) = "height=" h LF` followed by each entry and `LF`. UTF-8, no `CR`.

### 8.4 Root

```text
genesis_root = SHA-256("dmaps-state/3" LF
                       "network=" <dogecoin|testnet|regtest> LF
                       "h3=4.2.1" LF)

root(h) = root(h-1)                                    if delta(h) is empty
root(h) = SHA-256(root(h-1) LF delta_text(h))          otherwise
```

Hashes are 64 lowercase hex characters; `root(h-1)` enters the hash as that hex text. Before block 0 the root is `genesis_root`.

### 8.5 Snapshot (`dmaps-checkpoint/3`)

On demand, an indexer MAY print the full state at height `h`:

```text
dmaps-checkpoint/3
network=<dogecoin|testnet|regtest>
height=<h>
h3=4.2.1
root=<root(h)>
<every record line in record order>
```

LF newlines, a final LF, no other lines. Its SHA-256 is the snapshot hash. A snapshot is an audit aid, not part of consensus: two indexers that agree on `root(h)` hold the same records.

### 8.6 API

- `GET /api/dmaps/state/root` and `/api/dmaps/state/root/{height}` → `{ "version": "dmaps-state/3", "height", "root", "last_change_height" }`.
- `GET /api/dmaps/state/delta/{height}` → `{ "version", "height", "prev_root", "root", "entries", "delta_text" }` (`entries` empty and `delta_text` null when the block changed nothing).
- `GET /api/dmaps/checkpoint/latest` → `{ "version": "dmaps-checkpoint/3", "state_version", "height", "root", "hash", "checkpoint" }` at the indexed tip.

`/api/land/…` serves the same routes. Full shapes: [API.md](API.md).

A worked example, block by block with every delta, root and snapshot hash, is in [../vectors/indexer-state.json](../vectors/indexer-state.json).

---

## 9. Conformance

To claim compatibility:

1. The JSON profile cases (`PROF-*`) and op parse cases in [../protocols/dland/vectors/conformance.json](../protocols/dland/vectors/conformance.json) pass or fail as listed.
2. The claim cases and geo cells in [../protocols/dogemaps/vectors/conformance.json](../protocols/dogemaps/vectors/conformance.json) match, including all 256 `geo_batch` heights and the H3 parent and `invalid_cells` cases.
3. Every block in [../vectors/indexer-state.json](../vectors/indexer-state.json) produces the listed results, delta and `state_root`, and the listed `snapshot_hash` where given.
4. Undoing the last block of the vector restores the previous root.

`npm test` checks the reference against all of these and checks that the vector files equal what `npm run vectors` generates. Dogex runs the same files in its Rust unit tests (`cargo test dmaps_` and `cargo test dland`).

---

## 10. What is *not* in the consensus index

The district Founder, Land Standing/2, neighbor `gridDisk` counts, district-majority skins, and UI geocoding are non-consensus. If an indexer cannot compute `gridDisk`, it MUST set `neighbors_indexed: false` rather than invent counts. Those fields MUST NOT appear in records, deltas or snapshots.
