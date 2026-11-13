# Deterministic indexing (ÐMaps + ÐLand)

**Status:** Normative for any indexer that claims compatibility with this repository, including the reference implementation (Dogex). **Version 0.2.0** (`dmaps-state/2`). See [../changelog.md](../changelog.md).

Two independent indexers, given the same Dogecoin chain, the same activation heights from this document, and this spec, **MUST** produce **identical** protocol state at every height, and **MUST** agree on the **state root** in §8 after every block.

This is the document that makes a third-party indexer possible. Protocol payloads live in [../protocols/dogemaps/spec.md](../protocols/dogemaps/spec.md) and [../protocols/dland/spec.md](../protocols/dland/spec.md). This file pins *how* those payloads are folded into state. Where a protocol spec and this file disagree, this file wins.

Design rules: no trusted party, no off-chain input, no floating point in consensus, and every rule is a pure function of confirmed chain data. Every number in this file is an integer.

---

## 1. Network and activation (spec constants)

| Constant | Mainnet | Testnet | Regtest |
| --- | --- | --- | --- |
| `MAPS_ACTIVATION_HEIGHT` | **disabled** (`null`) until a revision of this document announces a height | disabled (`null`) | `0` |
| `LAND_ACTIVATION_HEIGHT` | **disabled** (`null`) until announced here | disabled (`null`) | `0` |
| `COMMIT_WINDOW` (`W`) | `30` | `30` | `30` |
| `REANCHOR_COOLDOWN` | `144` | `144` | `144` |
| `CLAIM_WINDOW` | `2016` | `2016` | `2016` |
| `H3_VERSION` | Uber H3 **4.2.1** | same | same |
| `MAPS_H3_RES` | `9` | `9` | `9` |
| `H3_ANCHOR_RES` | `12` | `12` | `12` |
| `H3_DISTRICT_RES` | `7` | `7` | `7` |
| `H3_REGION_RES` | `4` | `4` | `4` |
| `MAPS_MAX_PAYLOAD` | `8192` bytes | same | same |
| `LAND_MAX_PAYLOAD` | `16384` bytes | same | same |
| `MAX_DEPTH` | `32` | same | same |

`null` / disabled means the updater MUST NOT apply protocol state on that network. Operators MAY set a local override (Dogex: `DOGEX_DOGEMAP_ACTIVATION_HEIGHT`, `DOGEX_LAND_ACTIVATION_HEIGHT`) for experiments; that index is **not** the canonical mainnet index. The canonical height for mainnet, when the protocols launch, will be written into this table in a dated spec revision. Until then the mainnet state root is the genesis root (§8.4) at every height.

An inscription confirmed at height `h` is eligible for a protocol only if `h >= ACTIVATION_HEIGHT` for that protocol (and the height is not disabled). ÐLand reads ÐMaps titles, so an indexer that applies ÐLand MUST also apply ÐMaps.

---

## 2. Carrier and body

### 2.1 Carrier

Only Doginals inscription payloads count. OP_RETURN-only JSON MUST be ignored by ÐMaps and ÐLand.

- **ÐMaps `claim`:** the inscription MUST be the reveal transaction's first inscription (`i0`) and its whole body MUST be in that one transaction (no continuation in a later transaction). The committed lock ([committed-envelope.md](committed-envelope.md)) is recommended, not required.
- **ÐLand `pack`:** any inscription. A pack body may span several transactions (large schemas); it applies at the transaction that completes the body.
- **ÐLand `build`, `anchor`:** the inscription MUST be `i0` and whole in one transaction, and MUST be **bound**: `vin[0].scriptSig` carries an `ord` envelope under the committed lock (committed-envelope §3), and the Doginals body that envelope binds is byte-identical to the inscription body. A `dog`-marker envelope is not a ÐLand carrier. An unbound `build` or `anchor` is **invalid**.

On Dogecoin era-1 envelopes only `vin[0]` carries an inscription, so `i0` is the only inscription a reveal can have. The `i0` rule makes that explicit and removes any doubt about envelope order inside one transaction.

### 2.2 JSON profile (MUST)

Every ÐMaps and ÐLand body is read through one profile, so indexers built on different JSON libraries agree byte for byte. A body that breaks any rule is **not** a protocol op (it is ignored, not an error):

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

Within a block, ops are applied in transaction order (index in the block, ascending; 0 is the coinbase). A transaction yields at most one op: claims, builds and anchors are `i0` of their own transaction, and a pack applies at the one transaction that completes its body. No further tie-break is needed.

Blocks are applied in height order, 0…tip, on the current best chain. This is the same spirit as ÐMP / ÐNS canonical order.

---

## 4. ÐMaps titles

A confirmed inscription is a **valid claim** at confirmation height `h` when all of these hold (reasons in brackets are the reference names):

1. Carrier §2.1 (`i0`, single transaction) [`multi_tx`]; JSON profile §2.2 with `MAPS_MAX_PAYLOAD`.
2. `p == "Ð:MAPS"`, `v == "1"`, `op == "claim"`, `chain == "dogecoin"`.
3. `title` is an object; `title.block_height` is an integer `0 ≤ n ≤ 2^32 − 1` and `≤ h` [`time_travel`]; `title.tier == "standard"`.
4. `geo` is an object; `geo.h3_res == 9`; `geo.h3_cell` is a string equal to `DOGEMAPS_H3(block_height, 9)` (ÐMaps §7), computed with H3 4.2.1 `latLngToCell`.
5. `fair` is an object; `fair.stake_burn == true`; `fair.stake_koinu` is a canonical decimal string (`0` or no leading zero, at most 20 digits, value ≤ `2^64 − 1`).
6. **Stake floor:** `stake_koinu ≥ 10 × (1000 + min(G, 5000))²` koinu, where `G` is the number of canonical titles confirmed at heights `[h − 2016, h − 1]` (titles confirmed in block `h` itself do not count). Quiet chain: 0.1 DOGE. Full activity (`G ≥ 5000`): 3.6 DOGE. This is integer arithmetic and equals the earlier float formula exactly at every `G`.
7. **Burn output:** some output of the reveal transaction has scriptPubKey exactly `6a 11 "DDMAPBURN" u64le(stake_koinu)` (OP_RETURN, one 17-byte push: the 9 ASCII bytes `DDMAPBURN` then the stake as 8 little-endian bytes) and value `≥ stake_koinu`. The value is burned (OP_RETURN outputs are unspendable), so stake cannot be recycled.

**First valid claim wins** that `block_height`, in canonical order (§3). Later valid claims for the same height are **duplicates**: they MUST NOT replace the title. This holds within a block too: a second claim for the same height later in the same block is a duplicate.

- Legacy plain-text `{n}.dogemap` is **not** a v1 title. It MUST NOT occupy the title slot and MUST NOT authorize ÐLand ops.
- No aliases: top-level `block`, `block_height`, `h3` or `h3_cell` are not read. Only the shape above counts.
- No `params` op and no per-address caps. The floor plus a real burn is the whole spam rule; it needs no trusted parameter source and no address heuristics.
- Title transfers follow Doginals (§7). The title id never changes.

The reference validator is [../reference/dmaps-claim.mjs](../reference/dmaps-claim.mjs); vectors `CLAIM-*`, `floors` and `geo_batch` are in [../protocols/dogemaps/vectors/conformance.json](../protocols/dogemaps/vectors/conformance.json).

---

## 5. ÐLand

Apply each ÐLand op in canonical order (§3), after the ÐMaps claims of earlier transactions in the same block.

### 5.1 `pack`

Profile §2.2 with `LAND_MAX_PAYLOAD`; fields as ÐLand §7. No holder authorization. Pack id = inscription id. `name` is stored verbatim (not trimmed). The inline `schema`, if any, is stored as JCS text.

### 5.2 `build` and `anchor`: authorization

Invalid unless all of these hold, checked in this order (reason names in brackets):

1. The op is bound (§2.1) [`unbound`] and is `i0` [`not_vin0`].
2. A canonical ÐMaps title exists for `parcel` [`no_title`].
3. `title` in the body equals that title's inscription id [`title_mismatch`].
4. The title is not created in this same transaction, and the transaction **spends the title**: the title inscription is in the set of inscriptions carried by this transaction's inputs, taken **at the start of the transaction** (after all earlier transactions in the block) [`no_title_spend`].

The start-of-transaction spent set makes the check independent of the order an indexer walks inputs, outputs or inscriptions inside one transaction. Detached signatures are never authorization.

### 5.3 `build`

As ÐLand §8: the pack MUST exist [`no_pack`]; a sealed slot or a parcel with `seal_all` accepts nothing more [`sealed`]. `remove` clears content; `content` replaces it; a `seal` or `seal_all` without `content` **keeps** the live content. `applied` counts accepted builds on the slot.

### 5.4 `anchor`

As ÐLand §9. `h3_res` MUST be `12` and `h3_cell` a canonical res-12 cell: 15 lowercase hex digits exactly as H3 `cellToString` prints them, and H3 `isValidCell` true (mode, reserved bits, base cell, pentagon deleted subsequence, and unused digits all checked).

- **Priority key:** `(height, tx_index, vout)` of the commit (ÐLand §9.2), lower wins.
- **Cooldown:** a parcel whose last successful cell change was at `L` may change again only at `h ≥ L + 144` [`cooldown`]. First pin has no cooldown. A failed attempt does not reset it.
- **Same cell:** anchoring to the cell the parcel already holds is `already_anchored` and changes nothing (the key is not refreshed).
- **Taking a cell:** a free cell is taken. An occupied cell (another parcel) is taken only when the occupant is still pending (`h ≤ occupant.height + W`) and the incoming key is strictly lower [`cell_taken`]. The **displaced** parcel is unanchored (its live cell becomes none); its cooldown is unchanged.
- **Moving:** a parcel that takes a new cell releases its old one.
- **Clear:** `clear: true` releases the parcel's cell [`not_anchored` if it has none] and counts as a cell change for the cooldown.
- **Finality:** an occupancy with key height `k` is final once `tip > k + W`; then nobody can displace it.

### 5.5 Districts and founders (end of block)

After the last op of block `h`, for every district (res-7 parent) whose founder is not final:

- The founder is the live occupant in that district with the **lowest priority key**. If the district has no live occupant, it has no founder record.
- The founder is **final**, and permanent, once its key is final at `h` (`h > key.height + W`). A final founder never changes, even if its parcel later leaves the district (until a reorg removes the block that made it final).

This rule is evaluated only for districts touched since their founder was last settled plus districts with a pending founder, so it is bounded per block.

---

## 6. Reorgs (MUST)

On a reorg that disconnects heights `h…old_tip`:

1. Undo state written at those heights, newest first.
2. Replay the new branch from the common ancestor, using the same rules as a first index.
3. Titles, packs, builds, cells, founders, deltas and roots that existed only on the orphaned branch MUST disappear.
4. The state root after the common ancestor MUST equal what it was before the orphaned blocks were applied.

Per-block undo is cheap because state changes are already explicit: the delta of block `h` (§8.2) is exactly what must be undone. Dogex keeps a byte-level undo snapshot of every key it writes in a block, so a disconnect restores records, indexes, deltas and the root together. Other implementations MAY rebuild from genesis; the resulting root at each height MUST still match.

---

## 7. Transfers

Inscription transfers follow Doginals: spending the current satpoint moves the inscription to a new outpoint. The title *id* does not change. ÐLand live builds and the live anchor stay attached to the parcel. After a transfer, a previous holder's unconfirmed parcel-state op can no longer spend the title and is invalid if it confirms later (§5.2 rule 4). A transaction that both moves the title and carries a valid op is valid: the title was in its inputs at the start of the transaction.

---

## 8. State commitment (MUST)

### 8.1 Why there is a commitment

Two indexers need a cheap way to prove they hold the same state, and a reorg needs a cheap way to be checked. `dmaps-checkpoint/1` did this by rebuilding and hashing the **whole** state after every block: O(state) work and storage per block, forever, growing with every parcel. `dmaps-state/2` replaces it with an **incremental root**: each block that changes state hashes only its own change (the delta) onto the previous root. Same guarantee, O(change) per block, and nothing is written for a block that changes nothing. The full text (§8.5) is still available on demand for audits.

### 8.2 Records

Consensus state is a set of record lines. Each record has a **key** (its leading fields) and a **line**:

| Section | Key | Line |
| --- | --- | --- |
| Title | `T <block_height>` | `T <block_height> <inscription_id>` |
| Pack | `P <id>` | `P <id> <name_json> <version_json>` (RFC 8259 strings, as `JSON.stringify` writes them) |
| Build slot | `B <parcel> <pack_id>` | `B <parcel> <pack_id> <applied> <sealed 0\|1> <content_sha256\|none>` |
| Parcel live | `L <parcel>` | `L <parcel> <cell\|-> <last_change\|-> <seal_all 0\|1>` |
| Cell | `C <h3_cell>` | `C <h3_cell> <parcel> <key_height> <key_tx_index> <key_vout> <from_commit 0\|1> <anchor_id>` |
| District founder | `D <district_h3>` | `D <district_h3> <founder_parcel> <anchor_id> <final 0\|1> <key_height> <key_tx_index> <key_vout>` |

- A build slot exists only once `applied > 0` or it is sealed. `content_sha256` is the lowercase hex SHA-256 of the live content as JCS text (§2.2), or `none`.
- A parcel-live record exists only when the parcel has a cell, a `last_change`, or `seal_all`.
- Numbers are decimal, no leading zeros.

**Order:** sections `T, P, B, L, C, D`; within `T` and `L` by the number; within `B` by parcel number then pack id; within `P`, `C`, `D` by the id or cell, bytewise.

Standing scores, neighbor counts, explorer rows, missed-claim lists and any index structure are **not** records.

### 8.3 Delta

The delta of block `h` compares the records before and after the block, in record order:

- `+<line>` for a record that is new or whose line changed;
- `-<key>` for a record that was removed.

`delta_text(h) = "height=" h LF` followed by each entry and `LF`. UTF-8, no `CR`.

### 8.4 Root

```text
genesis_root = SHA-256("dmaps-state/2" LF
                       "network=" <dogecoin|testnet|regtest> LF
                       "maps_activation=" <decimal|null> LF
                       "land_activation=" <decimal|null> LF
                       "h3=4.2.1" LF)

root(h) = root(h-1)                                    if delta(h) is empty
root(h) = SHA-256(root(h-1) LF delta_text(h))          otherwise
```

Hashes are 64 lowercase hex characters; `root(h-1)` enters the hash as that hex text. Before the first block of either protocol the root is `genesis_root`.

### 8.5 Snapshot (`dmaps-checkpoint/2`)

On demand, an indexer MAY print the full state at height `h`:

```text
dmaps-checkpoint/2
network=<dogecoin|testnet|regtest>
height=<h>
maps_activation=<decimal|null>
land_activation=<decimal|null>
h3=4.2.1
root=<root(h)>
<every record line in record order>
```

LF newlines, a final LF, no other lines. Its SHA-256 is the snapshot hash. A snapshot is an audit aid, not part of consensus: two indexers that agree on `root(h)` hold the same records.

### 8.6 API

- `GET /api/dmaps/state/root` and `/api/dmaps/state/root/{height}` → `{ "version": "dmaps-state/2", "height", "root", "last_change_height" }`.
- `GET /api/dmaps/state/delta/{height}` → `{ "version", "height", "prev_root", "root", "entries", "delta_text" }` (`entries` empty and `delta_text` null when the block changed nothing).
- `GET /api/dmaps/checkpoint/latest` → `{ "version": "dmaps-checkpoint/2", "state_version", "height", "root", "hash", "checkpoint" }` at the indexed tip.

`/api/land/…` serves the same routes. Full shapes: [API.md](API.md).

A worked example, block by block with every delta, root and snapshot hash, is in [../vectors/indexer-state.json](../vectors/indexer-state.json).

---

## 9. Conformance

To claim compatibility:

1. The JSON profile cases (`PROF-*`) and op parse cases in [../protocols/dland/vectors/conformance.json](../protocols/dland/vectors/conformance.json) pass or fail as listed.
2. The claim cases, floors and geo cells in [../protocols/dogemaps/vectors/conformance.json](../protocols/dogemaps/vectors/conformance.json) match, including all 256 `geo_batch` heights and the H3 parent and `invalid_cells` cases.
3. Every block in [../vectors/indexer-state.json](../vectors/indexer-state.json) produces the listed results, delta and `state_root`, and the listed `snapshot_hash` where given.
4. Undoing the last block of the vector restores the previous root.

`npm test` checks the reference against all of these and checks that the vector files equal what `npm run vectors` generates. Dogex runs the same files in its Rust unit tests (`cargo test dmaps_` and `cargo test dland`).

---

## 10. What is *not* in the consensus index

Land Standing/1, neighbor `gridDisk` counts, district-majority skins, and UI geocoding are non-consensus. If an indexer cannot compute `gridDisk`, it MUST set `neighbors_indexed: false` rather than invent counts. Those fields MUST NOT appear in records, deltas or snapshots.
