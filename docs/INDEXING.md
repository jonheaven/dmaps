# Deterministic indexing (ÐMaps + ÐLand)

**Status:** Normative for any indexer that claims compatibility with this repository, including the reference implementation (Dogex).

Two independent indexers, given the same Dogecoin chain, the same activation heights from this document, and this spec, **MUST** produce **identical** protocol state at every height, and **MUST** agree on the **checkpoint hash** in §8.

This is the document that makes a third-party indexer possible. Protocol payloads live in [../protocols/dogemaps/spec.md](../protocols/dogemaps/spec.md) and [../protocols/dland/spec.md](../protocols/dland/spec.md). This file pins *how* those payloads are folded into state.

---

## 1. Network and activation (spec constants)

| Constant | Mainnet | Testnet | Regtest |
| --- | --- | --- | --- |
| `MAPS_ACTIVATION_HEIGHT` | **disabled** (`null`) until a revision of this document announces a height | disabled (`null`) | `0` |
| `LAND_ACTIVATION_HEIGHT` | **disabled** (`null`) until announced here | disabled (`null`) | `0` |
| `COMMIT_WINDOW` (`W`) | `30` | `30` | `30` |
| `REANCHOR_COOLDOWN` | `144` | `144` | `144` |
| `H3_VERSION` | Uber H3 **4.2.1** | same | same |
| `H3_ANCHOR_RES` | `12` | `12` | `12` |
| `H3_DISTRICT_RES` | `7` | `7` | `7` |
| `H3_REGION_RES` | `4` | `4` | `4` |

`null` / disabled means the updater MUST NOT apply protocol state on that network. Operators MAY set a local override (Dogex: `DOGEX_DOGEMAP_ACTIVATION_HEIGHT`, `DOGEX_LAND_ACTIVATION_HEIGHT`) for experiments; that index is **not** the canonical mainnet index. The canonical height for mainnet, when the protocols launch, will be written into this table in a dated spec revision. Until then, mainnet checkpoints in this repo are empty at every height.

An inscription confirmed at height `h` is eligible for a protocol only if `h >= ACTIVATION_HEIGHT` for that protocol (and the height is not disabled).

---

## 2. Carrier

Only Doginals / Dogenals **inscription** payloads (witness or scriptSig envelope) count. OP_RETURN-only JSON MUST be ignored by ÐMaps and ÐLand. Envelope marker `ord` or `dog` is acceptable; the JSON body is what is parsed.

ÐLand `build` and `anchor` MUST additionally be **committed** (content-binding) reveals as defined in [committed-envelope.md](committed-envelope.md). ÐMaps ops SHOULD be committed; v1 does not reject a classic ÐMaps `claim` solely for being unbound (existing draft behavior). ÐLand parcel-state ops that are unbound are **invalid**.

---

## 3. Canonical inscription order (MUST)

Within a block, inscriptions are ordered by:

1. Transaction index in the block, ascending (0 is the coinbase).
2. Reveal output index `vout`, ascending.
3. If one transaction reveals several inscriptions, the inscription order defined by the Doginals envelope (the order of inscription envelopes in the inputs / script, as the Doginals indexer numbers them). If that is unavailable, `vout` then a documented secondary key MUST be used consistently.

Blocks are applied in height order, 0…tip, on the current best chain. This is the same spirit as ÐMP / ÐNS canonical order.

---

## 4. ÐMaps titles

Apply each inscription body that parses as `p: "Ð:MAPS"`, `v: "1"`.

- `op: "claim"`: valid only if the schema in ÐMaps §6.1 holds, `title.block_height ≤ confirmation height`, `geo.h3_cell` equals the official `DOGEMAPS_H3(block_height, h3_res)` cell (§7, official cells in §7.5), and the stake rule in §9 is satisfied. **First valid claim wins** that `block_height`. Later valid claims for the same height are **duplicates** (logged as missed if the indexer keeps a miss list; they MUST NOT replace the title).
- Legacy plain-text `{n}.dogemap` is **not** a v1 title. It MUST NOT occupy the title slot and MUST NOT authorize ÐLand ops.
- `upgrade` / `link` / `params`: as ÐMaps §6. They do not change the canonical title id.
- Reorgs: drop titles whose claim inscription lived in a rolled-back block; restore any title that a rolled-back later claim had not been allowed to overwrite (FCFS: there is nothing to restore unless you were keeping an illegal overwrite — you should not have overwritten).

Indexers MAY accept, in addition to the nested §6.1 shape, the historical aliases `block` / `block_height` at the top level and `h3` / `h3_cell` at the top level, **provided** that if `title.block_height` is present it is authoritative, and the derived cell is still verified. The public examples use the §6.1 shape only.

---

## 5. ÐLand

Apply each inscription body that parses as `p: "Ð:LAND"`, `v: "1"`, in the same order, after any ÐMaps claim in that same inscription position has been considered (a transaction cannot both be a title and a LAND op).

### 5.1 `pack`

No holder authorization. Pack id = inscription id. First (only) write wins; a second body on the same id is impossible. Store name, version, schema and/or schema_uri, note, supersedes, height.

### 5.2 `build` and `anchor` (parcel-state)

Invalid unless all of [ÐLand §6](../protocols/dland/spec.md) hold at the start of the reveal transaction (after earlier transactions in the block):

1. A canonical ÐMaps v1 title exists for `parcel`.
2. `title` in the body equals that inscription id.
3. The reveal is a single-transaction **committed** inscription.
4. The transaction **spends the current title outpoint** (satpoint of the title as of the start of this transaction).
5. Detached signatures are not authorization.

Then apply [§8](../protocols/dland/spec.md) or [§9](../protocols/dland/spec.md).

**Tie-breaks for a cell:** the commit-first key in ÐLand §9.2 / ÐNS §5.7, tuple `(height, tx_index, vout)` (or commit position), **lower wins**. Pending vs final uses `W = 30` and tip = the height of the block being applied (`is_final` iff `tip > key_height + W`). Equal keys cannot occur for two different reveals (same height, tx index, and vout would be the same output). If they theoretically compare equal, the first in canonical inscription order wins and the second is invalid.

**Re-anchor cooldown:** 144 blocks since the parcel's last successful cell change (not counting a failed take). First pin has no cooldown.

**Founder:** first occupant of a district becomes the provisional founder; once that founder's occupancy key is final, the badge is permanent (until a reorg of that block). See ÐLand §10.1.

---

## 6. Reorgs (MUST)

On a reorg that disconnects heights `h…old_tip`:

1. Undo state written at those heights, in reverse height order, then reverse inscription order within the height.
2. Replay the new branch from the common ancestor, using the same rules as a first index.
3. Founders, cell winners, builds, and titles that existed only on the orphaned branch MUST disappear.
4. Checkpoint hashes at or above the disconnected height are invalid and MUST be recomputed.

The reference Dogex implementation stores an undo log per block so this is mechanical. Other implementations MAY rebuild from genesis; the resulting state at each height MUST still match.

---

## 7. Transfers

Inscription transfers follow Doginals: spending the current satpoint moves the inscription to a new outpoint. The title *id* does not change. ÐLand live builds and the live anchor stay attached to the title id. After a transfer, a previous holder's unconfirmed parcel-state op can no longer spend the old outpoint and MUST NOT be applied if it never confirms.

---

## 8. Checkpoint / state hash (MUST)

After applying block `h`, a conformant indexer MUST be able to emit a **checkpoint** whose SHA-256 matches every other conformant indexer.

### 8.1 Text format (`dmaps-checkpoint/1`)

UTF-8, `LF` newlines, no `CR`, no trailing spaces. Lines are emitted in this exact order. The file ends with a single newline after the last line (a non-empty file always ends in `LF`).

1. Header lines:
   - `dmaps-checkpoint/1`
   - `network=<dogecoin|testnet|regtest>`
   - `height=<decimal>`
   - `maps_activation=<decimal|null>`
   - `land_activation=<decimal|null>`
   - `h3=4.2.1`
2. Title lines, sorted by `block_height` ascending: `T <height> <inscription_id>`
3. Pack lines, sorted by pack inscription id lexicographically: `P <id> <name_json> <version_json>`
   - `name_json` and `version_json` are RFC 8259 JSON strings (quoted, escaped).
4. Build-slot lines, sorted by `parcel` ascending, then pack id lexicographically. Omit slots that have no live content **and** are not sealed and never applied. Include a slot if `applied > 0` or `sealed`:
   - `B <parcel> <pack_id> <applied> <sealed 0|1> <content_sha256|none>`
   - `content_sha256` is the lowercase hex SHA-256 of the live content as **RFC 8785 / JCS** canonical JSON (or `none` if content is empty / removed). If an implementation cannot emit JCS, it MUST emit `none` only when content is absent; when content is present it MUST use JCS. The reference encoder is in [../reference/checkpoint.mjs](../reference/checkpoint.mjs).
5. Cell lines, sorted by `h3_cell` lexicographically: `C <h3_cell> <parcel> <key_height> <key_tx_index> <key_vout> <from_commit 0|1> <anchor_id>`
6. District founder lines, sorted by district cell lexicographically: `D <district_h3> <founder_parcel> <anchor_id> <final 0|1> <key_height> <key_tx_index> <key_vout>`

No other lines. Do **not** include standing scores, neighbor counts, OG dogemap rows, or missed-claim logs in the checkpoint. Those are advisory.

### 8.2 Hash

`checkpoint_hash = SHA-256(checkpoint_bytes)` as 64 lowercase hex characters.

`GET /api/dmaps/checkpoint/{height}` (and `/api/land/checkpoint/{height}`) MUST return `{ "version": "dmaps-checkpoint/1", "height", "hash", "checkpoint" }` where `checkpoint` is the exact text and `hash` is its SHA-256.

A worked example is in [../vectors/indexer-state.json](../vectors/indexer-state.json).

---

## 9. Conformance

To claim compatibility:

1. Official ÐMaps geo cells in [../protocols/dogemaps/vectors/conformance.json](../protocols/dogemaps/vectors/conformance.json) match.
2. Every case in [../vectors/indexer-state.json](../vectors/indexer-state.json) produces the listed state and `checkpoint_hash`.
3. Adversarial cases in [../protocols/dland/vectors/conformance.json](../protocols/dland/vectors/conformance.json) (T1–T8) are rejected or applied as specified.
4. Reorg of the last block of a vector restores the previous checkpoint hash.

Dogex MUST pass (2)–(4) in its unit/integration tests against the same JSON files.

---

## 10. What is *not* in the consensus index

Land Standing/1, neighbor `gridDisk` counts, district-majority skins, and UI geocoding are non-consensus. If an indexer cannot compute `gridDisk`, it MUST set `neighbors_indexed: false` rather than invent counts. Those fields MUST NOT appear in the checkpoint.
