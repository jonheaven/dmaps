# ÐLand — expansion packs, builds, and real-world anchors on ÐMaps parcels

**Protocol:** ÐLand
**Identifier:** `p: "Ð:LAND"`
**Version:** 0.3
**Status:** Launch Draft
**Normative language:** RFC 2119
**Reference indexer:** Dogex, implementing this document and [../../docs/INDEXING.md](../../docs/INDEXING.md). The rules apply from the first block; Dogex's `DOGEX_LAND_ACTIVATION_HEIGHT` is an operator switch, not protocol.
**Companion:** [ÐMaps](../dogemaps/spec.md) (`p: "Ð:MAPS"`) remains the canonical block-title layer. ÐLand does **not** mint, override, or displace a ÐMaps claim.
**License:** MIT ([LICENSE](../../LICENSE))

The on-chain marker is `p: "Ð:LAND"`. A rename would be a dated revision with a new marker; until then, emit this marker exactly. ÐMaps stays the title protocol (one FCFS claim per `block_height`). ÐLand is the optional use layer: packs, holder-gated builds, and real-world H3 anchors.

---

## Table of contents

1. Design intent
2. Principles
3. Threat model (normative)
4. Relationship to ÐMaps, ÐGPS, ÐMP
5. Envelope and operations
6. Holder authorization (normative)
7. `pack` — expansion packs
8. `build` — attach, supersede, remove, seal
9. `anchor` — real-world H3 cells
10. Hierarchical H3, founders, and the flywheel (districts / regions)
11. Land Standing/2 (non-consensus)
12. Indexer state and algorithm
13. HTTP API (dogex)
14. Comparison: Bitcoin Bitmaps
15. Examples
16. Changelog

---

## 1. Design intent

ÐMaps already turns every Dogecoin block into a transferable title and a *deterministic* H3 overlay (hash of `block_height`, not a place the holder chose). Builders kept asking for two more things without blowing up that title layer:

- A permissionless **expansion-pack** system so a metaverse, game, or dApp can attach typed state to a parcel, and that state **follows the title**.
- A way for the **current holder** to pin a parcel to a **chosen** real-world cell (a park, a shop front, a street corner) — still not legal property.

Those belong in a companion metaprotocol, not in ÐMaps. The title rules stay minimal and stable (the Rodarmor instinct: inscriptions move as UTXOs; don't overload the base claim). ÐLand is optional. A parcel with no LAND inscriptions is still a valid ÐMaps title.

---

## 2. Principles

- **Permissionless.** Anyone may inscribe a `pack`. There is no registry, fee, or blessing authority. Pack id is the inscription id.
- **Holder-gated construction.** Only the *current* holder of the canonical ÐMaps title can change that parcel's LAND state. The chain must prove possession, not a lingering signature.
- **Bound to the title.** Builds and the live anchor travel with the title UTXO. Selling the parcel sells the land-use.
- **Chain-recomputable.** Every indexer that sees the same blocks and follows this spec MUST reach the same packs, builds and anchors (and so the same commit-first winners). The district Founder (§10.1) and Standing (§11) are read off that state; they are non-consensus but MUST be deterministic given the same inputs.
- **One scarce-cell rule, from genesis.** Real-world cells use the same commit-first priority as ÐNS ([dns/spec.md](https://github.com/jonheaven/dns) §5.7): one rule, no versions, no "early indexer" exceptions after a reindex from genesis.
- **Not legal land.** An anchor is a public pin on an H3 cell. It is not a deed, lease, or government registry.

---

## 3. Threat model (normative)

The unforgivable failure is: *someone other than the current title holder can change a parcel's LAND config* (builds, seals, anchors). The rules below exist to make that failure a protocol bug, not an app bug.

### 3.1 Assets and attackers

- **Asset.** The canonical ÐMaps title inscription for a `block_height` (the **title**: a `<n>.dogemap` text or JSON claim, ÐMaps §1). LAND state is a satellite of that title.
- **Attacker.** Anyone who does not currently control the title UTXO: a previous holder, a relayer, a marketplace, a pack author, a neighbor, a mempool observer.

### 3.2 Required defenses (MUST)

| # | Threat | Rule |
| --- | --- | --- |
| T1 | Stranger writes a `build` / `anchor` / `remove` / `seal` | Reveal is **invalid** unless it **spends the current title UTXO** as an input (§6). A signature from a key that used to hold the title, without that spend, is not enough. |
| T2 | Previous holder, after a confirmed transfer, applies a leftover op | The title outpoint moved. Their pending transaction can no longer spend it; Bitcoin rejects the spend. If it is still in the mempool, indexers MUST ignore it if it never confirms. After confirmation of the transfer, the old holder is not the authorizer. |
| T3 | Previous holder races a transfer in the same block | Indexers MUST evaluate authorization against the title's location **at the start of the reveal transaction** (after earlier transactions in the block, same canonical order as Ð:MOD). A reveal that does not spend the *then-current* outpoint is invalid. Two spends of the same outpoint cannot both confirm. |
| T4 | Relayer swaps the body (classic inscription lock) | State-changing parcel ops (`build`, `anchor`) MUST use a **content-binding / committed** reveal ([committed-envelope.md](../../docs/committed-envelope.md)). Classic (unbound) reveals are invalid for those ops. |
| T5 | Replay of an old body or signature onto a new reveal | The committed redeem binds this body to this reveal. The title outpoint in the spend is a nonce: once spent, it cannot be spent again. The body MUST name the title inscription id; a mismatch with the spent inscription is invalid. |
| T6 | Front-run / mempool copy of a chosen H3 cell | Cell occupancy uses **commit-first** priority, same tuple and window W = 30 as ÐNS §5.7. A bound commit that confirms first outranks a later copy even if the copy reveals first. |
| T7 | Two parcels (or two anchors) claim the same cell | A cell has at most one occupant. The lower priority key wins while the occupant is still **pending**; a **final** occupant cannot be displaced. |
| T8 | Reorg | Indexers MUST roll LAND state back with the block undo log and replay. Cell winners and builds that lived only in the orphaned branch disappear (and with them any Founder read off them). |
| T9 | Pack author or third party "upgrades" someone else's parcel | A `pack` inscription only defines a schema. Attaching it is a `build` and follows T1–T5. Pack authors have no remote control. |
| T10 | Holder lock-in without consent | Only the current holder can `seal`. Seal is per `(parcel, pack)` slot. A sealed slot ignores later builds. Seal does not freeze the title or the anchor. |

### 3.3 What this protocol does not prevent

Griefing by the *current* holder (sealing junk, anchoring a cell to sit on it). Every cell change is a transaction that spends the title, so flickering costs a fee each time, and a final occupant cannot be displaced anyway; there is no extra cooldown. Legal disputes, GPS spoofing, and off-chain "this is my house" claims are out of scope (§9.7).

---

## 4. Relationship to ÐMaps, ÐGPS, ÐMP

| Protocol | Role |
| --- | --- |
| **ÐMaps** | Canonical FCFS title per `block_height` + *derived* H3 overlay (§7 of ÐMaps). LAND never issues a second title and never lets a LAND op steal a ÐMaps claim. |
| **ÐLand** | Packs, holder-gated builds, *chosen* real-world anchors, district/region rollups, standing. |
| **ÐGPS** | Voluntary presence and findable places (`place`, coarse pings). An anchor MAY reference a ÐGPS `place` inscription. Overlaying title cells or anchors on a globe is UI, not a third marker. |
| **ÐMP** | Trading the **title** (and any upgrade inscriptions). LAND state follows the title automatically; there is no separate LAND settlement primitive. Product UIs MAY show ÐMP collections as district majorities (§10.4). |

A parcel is any block height with a canonical ÐMaps title, including existing `<n>.dogemap` text titles. A `build` or `anchor` applies only to a parcel that has one.

---

## 5. Envelope and operations

### 5.1 Every op (MUST)

- `p`: `Ð:LAND`
- `op`: one of `pack` | `build` | `anchor`
- `v` is not read. There are no protocol versions; a `v` of any value (or none) is ignored like any unknown key.
- An inscription payload (Doginals envelope). The body MUST satisfy the dmaps JSON profile ([INDEXING.md](../../docs/INDEXING.md) §2.2): strict UTF-8, one object, no duplicate keys, integers only, depth ≤ 32, at most **16 KiB**. A body that breaks the profile is not a ÐLand op.
- Types are strict and `null` is never a valid value for a named field. Unknown keys MUST be ignored.
- Inscription ids in bodies (`title`, `pack`, `place`, `supersedes`) are canonical: 64 lowercase hex, `i`, and an index with no leading zero.

`pack` MAY be any inscription: classic or committed, any index, and it MAY span several transactions (the pack id *is* the inscription id, so there is no scarce name to snipe and no carrier rule is needed). `build` and `anchor` MUST be the first inscription (`i0`) of a single-transaction, committed reveal (§6): those are the ops that change a holder's parcel.

### 5.2 Forbidden

- OP_RETURN-only payloads with no inscription envelope.
- `p` not exactly `Ð:LAND`.
- A `build` or `anchor` that targets a height with no canonical ÐMaps title.

---

## 6. Holder authorization (normative)

This section applies to every **parcel-state op**: `build` (including `remove` and `seal`) and `anchor` (including re-anchor and `clear`).

A parcel-state op is **valid** only when all of the following hold at confirmation:

1. **Canonical title.** Let `H` be `parcel` (block height) in the body. A canonical ÐMaps title for `H` exists (text or JSON form). Call it the **title inscription**.
2. **Body names the title.** The body MUST include `title` equal to that inscription id (`<txid>i<n>`, lowercase). A missing or mismatched `title` is invalid.
3. **Committed reveal.** The op is the reveal's first inscription (`i0`), its whole body is in this one transaction, and `vin[0]` carries an `ord` envelope under the content-binding redeem ([committed-envelope.md](../../docs/committed-envelope.md)) whose bound Doginals body is byte-identical to the op body. Unbound / classic reveals and `dog`-marker envelopes are invalid for these ops.
4. **Possession (spend the title).** The title inscription MUST be among the inscriptions carried by this transaction's inputs, taken **at the start of the transaction**. This is the same "you have to hold it to use it" rule as transferring an inscription. A signature from the holder's key that does **not** spend the title UTXO is **not** sufficient. A title created by this same transaction does not count.
5. **Current holder, not a stale one.** "Start of the transaction" means after all earlier transactions in the block have been applied (canonical order). A transfer earlier in the block moves the title; a later reveal that does not spend its new location is invalid. Because the set is taken before any input of this transaction is processed, the result does not depend on the order an indexer walks inputs or outputs.
6. **Do not authorize with a leftover signature.** Indexers MUST NOT accept BIP-137 / `signmessage` / detached signatures as authorization. Only the on-chain spend in this reveal counts.
7. The title input's spend MUST be a standard inscription transfer spend (the title continues on exactly one output, per the Doginals / dogex transfer rules already used for all inscriptions). After the tx, builds and the live anchor still refer to the *inscription id*, which has a new satpoint.

**After a transfer:** any unconfirmed parcel-state op from the previous holder becomes un-mineable once the title outpoint is spent. Indexers that see only the confirmed chain never apply it.

**Replay:** because the redeem commits the body and the title outpoint can be spent only once, an old body cannot be replayed onto a new holder or a new outpoint without a new committed reveal and a new spend by the then-current holder.

Wallets SHOULD pass the title through to an output controlled by the same holder (a "touch" of the title) unless the user is also transferring. Product listings of the title MUST treat this spend as a transfer of the UTXO (existing ÐMP rules: a listing on a spent outpoint is invalid).

---

## 7. `pack` — expansion packs

A `pack` inscription **is** the pack. Pack id = that inscription id. No unique-name race, no registrar.

```json
{
  "p": "Ð:LAND",
  "op": "pack",
  "name": "street-scene",
  "version": "1.0.0",
  "schema": { "type": "object", "properties": { "model": { "type": "string" } } },
  "schema_uri": "ipfs://bafy…",
  "note": "3D props for a parcel"
}
```

| Field | Rule |
| --- | --- |
| `name` | REQUIRED. String, 1–64 code points. Stored verbatim (indexers MUST NOT trim or normalize it). Not unique. Display / search only. |
| `version` | REQUIRED. Printable ASCII (`0x20`–`0x7e`), 1–32 chars (recommend semver). |
| `schema` | Optional object (JSON Schema or a pack-defined shape). Stored as JCS text. |
| `schema_uri` | Optional string, 1–512 code points (`ipfs:`, `https:`, or an inscription id). At least one of `schema` or `schema_uri` MUST be present. |
| `note` | Optional string, max 500 code points. |
| `supersedes` | Optional canonical inscription id of an older pack. |

A pack is immutable. A new version is a new inscription (new pack id). A pack MAY include `supersedes` (inscription id of an older pack) as a hint; indexers MUST store it and MUST NOT migrate existing builds automatically.

Indexers MUST store the pack record. They MAY validate later `build` content against `schema`; the reference indexer stores content without JSON Schema evaluation. Clients SHOULD validate.

---

## 8. `build` — attach, supersede, remove, seal

Attaches pack-typed content to a parcel. The live build for `(parcel, pack_id)` follows the title.

```json
{
  "p": "Ð:LAND",
  "op": "build",
  "parcel": 6197585,
  "title": "aaaa…i0",
  "pack": "bbbb…i0",
  "content": { "model": "ipfs://…" },
  "seal": false
}
```

| Field | Rule |
| --- | --- |
| `parcel` | REQUIRED. JSON integer `0 ≤ n ≤ 2^32 − 1`, the ÐMaps `block_height`. |
| `title` | REQUIRED. Canonical claim inscription id for `parcel` (§6.2). |
| `pack` | REQUIRED. Existing `pack` inscription id. Unknown pack → invalid. |
| `content` | Optional object. Stored as JCS text; the state hash covers it. |
| `remove` | Optional bool. If `true`, `content` MUST be omitted; the live build for this pack is cleared (history remains). |
| `seal` | Optional bool. If `true`, this `(parcel, pack)` slot is frozen after the apply. Later builds for that slot are ignored. |

A build MUST carry at least one of `content`, `remove: true`, `seal: true`. A `seal` without `content` keeps the live content as it is. (`seal_all` was removed in 0.3 and is ignored like any unknown key: freezing every slot is one `seal` per slot, so the parcel-wide flag only added a second state machine.)

**Supersede.** A valid new `build` for the same `(parcel, pack)` replaces the live content (unless the slot is sealed).

**Authorization:** §6.

---

## 9. `anchor` — real-world H3 cells

The holder pins the parcel to a **chosen** H3 cell at a fixed fine resolution. This is independent of ÐMaps' derived overlay cell (that overlay stays a function of `block_height` and MUST NOT change).

```json
{
  "p": "Ð:LAND",
  "op": "anchor",
  "parcel": 6197585,
  "title": "aaaa…i0",
  "h3_res": 12,
  "h3_cell": "8c28308280f37ff",
  "place": "cccc…i0"
}
```

### 9.1 Resolution (normative)

`H3_ANCHOR_RES` = **12**.

`h3_res` MUST be 12. `h3_cell` MUST be a canonical lowercase H3 v4 *cell* string at resolution 12, exactly as H3 4.2.1 `cellToString` prints it (15 hex digits starting with `8`, no `0x`, no uppercase), and H3 `isValidCell` MUST be true: mode 1, reserved bits zero, a valid base cell, every digit finer than res 12 set to 7, no digit coarser than res 12 set to 7, and no deleted pentagon subsequence. Indexers MUST reject anything else. The `invalid_cells` and `h3` vectors check this against h3-js.

**Why 12.** H3 res 12 has an average edge of about 9.4 m and an area of about 307 m² — a shop front or park entrance, in the same "findable but not a doorstep GNSS trace" spirit as ÐGPS fine places (~11 m). Res 11 (~20 m) is coarse for a pin. Res 13 (~3.7 m) is inside typical phone-GPS noise and invites fights over a doorway. One global fine resolution keeps a single uniqueness key.

### 9.2 Uniqueness and commit-first (normative)

Each resolution-12 cell has **at most one** occupant parcel.

Priority is **exactly** ÐNS §5.7 (and dogex `commit_window`):

- **W = 30** blocks.
- Priority key, lower wins: `(commit_height, commit_tx_index, commit_vout)` when the reveal is a single-tx committed inscription and the spent commit confirmed at most W blocks before the reveal; otherwise `(reveal_height, reveal_tx_index, 0)`.
- A free cell is taken by the first valid anchor.
- A **pending** occupant (tip ≤ key_height + W) MAY be displaced by a strictly lower key; the loser is unanchored (its live cell becomes none).
- A **final** occupant (tip > key_height + W) MUST NOT be displaced.
- This is the only cell-ordering rule, from genesis. Reindex from genesis under this rule if an older binary differed.

ÐLand has no bitwork rule. `bitworkc` / `bitworkr` keys on an anchor are ignored like any unknown key.

An anchor to the cell the parcel already holds changes nothing (`already_anchored`): it does not refresh the key.

### 9.3 One live cell per parcel; atomic switch

A parcel has at most one live occupant cell.

A new valid `anchor` for parcel P → cell B:

- If B cannot be taken (final other occupant, or pending other occupant with a lower or equal key), the op is **invalid** and P's previous cell is **unchanged**.
- If B can be taken, P occupies B and **immediately frees** its previous cell A (if any). If P is later displaced from B while still pending, P is unanchored (A is not retroactively kept, except on reorg of this block).

### 9.4 `clear`

`{"op":"anchor","parcel":H,"title":"…","clear":true}` frees the parcel's live cell. `h3_cell` MUST be omitted. Authorization §6.

### 9.5 No cooldown (removed in 0.3)

0.2 had a 144-block re-anchor cooldown. It is gone: commit-first (§9.2) is the only cell rule. A cooldown was a second clock on every parcel, in consensus state, guarding against something that already costs a title-spending transaction each time and cannot touch a final occupant.

### 9.6 Optional ÐGPS place

`place` MAY be a ÐGPS `place` inscription id. Indexers MUST store the reference and MUST NOT treat it as a second uniqueness key. The H3 cell is the scarce pin.

### 9.7 Not legal property (MUST)

UIs and indexers MUST NOT present an anchor as a government land registry, deed, easement, or proof of street address. GPS can be spoofed; H3 cells are a public grid, not a legal survey.

---

## 10. Hierarchical H3, founders, and the flywheel

Normative rollup keys use H3 parent cells of the live anchor (H3 v4 `cellToParent`). Informative product copy follows.

| Layer | Resolution | About | Why |
| --- | --- | --- | --- |
| **Pin** (the anchor) | 12 | Shop-front / park pin | Chosen, unique, holder-gated |
| **District** | 7 | Neighborhood (~5 km², ~1.2 km edge) | Early communities can fill a district; founder badge lives here |
| **Region** | 4 | City / metro (~1,770 km², ~22.6 km edge) | A globe that starts almost empty still has a coarse story |

Indexers MUST store, for each live anchor: `h3_cell` (res 12), `district` = `cellToParent(cell, 7)`, `region` = `cellToParent(cell, 4)` (H3 4.2.1). For example `8c28308280f37ff` → district `872830828ffffff` → region `8428309ffffffff`. The `h3` vectors list parents to check against.

### 10.1 District Founder (derived, non-consensus)

The **Founder** of a district is the live occupant in that district with the **lowest priority key** (§9.2), read from the current cells. If the district has no live occupant, it has no founder. `final` is true when that key is final at the tip (`tip > key_height + W`).

- It is not stored and not in the state root. Any indexer computes it from the cells it already has, at read time.
- It can change: when the founder's parcel moves, clears, or is sold and re-pinned, the next-lowest live key is the founder. The earliest pin still in the district is the story.
- It is a badge, not a privilege. Founders cannot evict neighbors or levy a fee.

0.2 made the Founder a permanent consensus record settled at the end of each block. That was a second state machine (pending set, end-of-block settlement, records that outlive their cell) for a badge no rule reads.

### 10.2 Flywheel (informative)

The protocol should be fun when the map is almost empty *and* when it is crowded.

1. **First pin in a quiet district.** The holder becomes Founder. That is a scarce, replayable story, not a pre-mine: you had to hold a title and win the cell.
2. **Neighbors raise the district.** Each additional live anchor in the same district, and each adjacent res-12 neighbor, increases district standing (§11). Early clusters look alive; late arrivals still add to the same score rather than starting at zero.
3. **Packs travel.** A useful pack (`street-scene`, a game, a shop-sign schema) can be used on many parcels. Pack adoption is a standing input. Builders ship packs; holders apply them; the pack becomes a reason to claim a title and anchor it.
4. **Communities show up as majorities.** A ÐMP collection or a pack that accounts for the largest share of live-anchored parcels in a district MAY be shown as that district's majority skin (product, not consensus).
5. **Regions keep the globe readable.** Zoomed-out maps paint regions by density and district counts so a world with a few hundred pins is not a blank sphere.

This is the opposite of a tip-snipe loop (ÐMaps already rejects that as the main game). The addictive loop is *place + build + neighbors*, not winning the next block height.

### 10.3 One-tap pin (informative, wallets / doginals.lol / Dojak)

Recommended flow, no new op:

1. Holder opens a parcel they own.
2. **Use my location** (device permission) or **search a place** (geocoder / ÐGPS place).
3. Snap to the res-12 cell. Show: free or occupied (and by which parcel), district name/id, whether this pin would make them Founder, neighbor count.
4. If free (or pending and they can outrank), build the committed commit/reveal, spending the title UTXO as §6.
5. After one confirm, show pending vs final and the W-block window.

Never pre-broadcast a reveal that would leak the cell without a prior commit if the user is in a race. Default: commit, wait one confirm, then reveal (same wallet advice as ÐNS).

### 10.4 District majority (informative)

For a district D, look at live anchors. Group by a product key: a named ÐMP collection membership of the title, or the most-used LAND pack on those parcels. The largest group MAY be labeled the majority. Ties: no majority. This MUST NOT alter occupancy or titles.

---

## 11. Land Standing/2 (non-consensus)

Suggested, deterministic, no token. Version `land-standing/2`: the same formula as `land-standing/1`, with `is_founder` read from the derived Founder of §10.1 (which can move) instead of a permanent record. Indexers and UIs MAY show it; two implementations given the same facts MUST match. It is a view, never a protocol rule.

Per-parcel inputs (all from confirmed, valid LAND + title state):

| Input | Definition |
| --- | --- |
| `builds` | Count of valid applied `build` ops on the parcel that are not pure failed/ignored (includes superseded; excludes invalid). |
| `live_packs` | Distinct pack ids with a live (not removed) build. |
| `streak` | Consecutive *anchor-days* the parcel has held *some* live cell, measured as floor((tip_height − last_unanchor_or_genesis) / 1440) capped at 365, reset when the parcel has no live cell. 1440 ≈ one Dogecoin day. |
| `neighbors` | Count of distinct *other* parcels whose live res-12 cell is in `gridDisk(cell, 1)` (H3 v4), or 0 if the parcel is unanchored. If an indexer cannot compute `gridDisk`, it MUST omit `neighbors` from the score and set `neighbors_indexed: false` rather than guess. |
| `district_peers` | Live anchors in the same district, excluding self, or 0 if unanchored. |
| `is_founder` | 1 if this parcel is the district Founder (§10.1), else 0. |

```
score = 4 * live_packs
      + 2 * min(builds, 50)
      + 3 * min(streak, 365)
      + 5 * neighbors
      + 2 * min(district_peers, 100)
      + 25 * is_founder
```

District standing (display): sum of member parcel scores, plus `10 * live_anchor_count`. Region standing: sum of district standings in that region.

Reference: [standing.mjs](standing.mjs).

---

## 12. Indexer state and algorithm

Consensus state is the record set of [INDEXING.md](../../docs/INDEXING.md) §8.2:

- **T** titles: `block_height → title inscription id`.
- **P** packs: id, name, version (schema, schema_uri, note, supersedes and height are stored but not in the line).
- **B** build slots `(parcel, pack)` that have live content or a seal: sealed, SHA-256 of the live content as JCS (or `none`).
- **C** cells: occupant parcel, priority key, anchor id.

That is all. A parcel's live cell is the one `C` record naming it. After every block that changes these records, the indexer chains a 32-byte **state root** over the block's delta (INDEXING §8.4); the root is an audit commitment that no rule reads. Nothing else happens at the end of a block.

Indexes (derived, not consensus): each parcel's live cell, live cells per district in priority order (whose first row is the Founder), and live-cell counts per district per region. They make parcel, district and region queries O(page).

**Order.** For each inscription in canonical order: if it is a ÐMaps claim, apply it (INDEXING §4); if `p` is `Ð:LAND`, parse; apply `pack`; for `build`/`anchor`, apply §6 then §8/§9. Reorg: undo the block (the block's delta is exactly what changed).

---

## 13. HTTP API (dogex)

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/land/status` | network, activation, tip, window, resolutions, state root, `neighbors_indexed` |
| GET | `/api/land/parcel/{block}` | title and its res-9 cell, builds, live anchor, district/region, founder flag (derived), standing/2 |
| GET | `/api/land/cell/{h3}` | occupant, priority, status |
| GET | `/api/land/packs` | list (`after`, `limit`, `next`) |
| GET | `/api/land/district/{h3}` | derived founder, live-cell count, live parcels in priority order (`after`, `limit`, `next`) |
| GET | `/api/land/districts` | every district with a live anchor: `live_cells`, derived founder (`after`, `limit`, `next`) |
| GET | `/api/land/holder/{address}` | titles held now, anchored cells, builds (`after`, `limit`, `next`) |
| GET | `/api/land/region/{h3}` | districts with live cells and their counts (`after`, `limit`, `next`) |
| GET | `/api/dmaps/state/root[/{height}]`, `/api/dmaps/state/delta/{height}` | state root chain (INDEXING §8) |

Every list is cursor-paged and served from an index; none is capped. Full shapes: [docs/API.md](../../docs/API.md).

Capabilities (`GET /api/doginals/capabilities`) MUST describe the network the node indexes and include a `land` object: `network`, marker, `h3_res` 12, district 7, region 4, `holder_spend: true`, `commit_first: true`, `state_version`.

---

## 14. Comparison: Bitcoin Bitmaps

Bitcoin Bitmaps (and `<n>.dogemap`) associate a **block number** with a title-like inscription. That is a good, simple idea. ÐMaps *is* that claim on Dogecoin (first `<n>.dogemap` per height wins, plus a derived H3 overlay).

Bitmaps do **not** specify:

- a holder-gated, transferable **build** layer with typed **expansion packs**;
- a **chosen** real-world binding (no unique H3 pin, no commit-first cell race);
- hierarchical districts/regions or a derived Founder badge;
- a threat model that requires spending the title to change "what's on the land."

ÐLand is a **superset layer**: it adds those without changing who won a ÐMaps (or Bitmap-style) block title. A Bitmap-like holder can keep doing nothing. A holder who wants a shop pin and a metaverse pack uses ÐLand. No wrap, no second title, no migration of the claim.

---

## 15. Examples

See [examples/](examples/), [vectors/conformance.json](vectors/conformance.json) and the block log in [../../vectors/indexer-state.json](../../vectors/indexer-state.json). Adversarial vectors (MUST be tested by a conformant indexer) include: raw JSON-profile cases (BOM, duplicate keys, floats, `-0`, lone surrogates, depth); non-holder build; stale-holder build after transfer; an op that is not `i0`; a title created in the same transaction; unbound (classic) build; body/`title` mismatch; front-run anchor lost to an earlier commit and the loser unanchored; two anchors on one cell (lower key wins; final not displaced); re-anchor to the same cell; clear and reuse of a cell in the same block; seal without content; `seal_all` ignored; `v` not read; invalid H3 cells; reorg of an anchor.

---

## 16. Changelog

- **0.3** — Simplification. `v` is not read (no versions). The 144-block re-anchor cooldown is removed; commit-first is the only cell rule. `seal_all` is removed (one `seal` per slot does the same). The district Founder is derived from the cells on read and is no longer consensus state (no `D` records, no end-of-block settlement); Standing becomes `land-standing/2`. The parcel-live `L` record is gone: a parcel's cell is the `C` record that names it, and `B` lines drop the informative `applied` count, so the state is `T/P/B/C`. Existing `<n>.dogemap` text titles authorize ÐLand like JSON titles. Packs stay any-inscription, multi-transaction allowed; the vin[0] committed envelope and title spend stay mandatory for `build`/`anchor`. Rationale: [changelog](../../changelog.md).

- **0.2** — Strict JSON profile and canonical ids; `build`/`anchor` must be `i0` in a bound `ord` envelope; title spend checked against the start-of-transaction spent set and never by a title created in the same transaction; full `isValidCell` check and `cellToParent` parents; displacement unanchors the loser; same-cell re-anchor is a no-op; seal without content keeps content; pack names verbatim; founders settled at end of block from the lowest live key; no bitwork; incremental `dmaps-state/2` root replaces the per-block checkpoint; paged district/region queries.
- **0.1** — Initial launch draft: packs, holder-spend builds, res-12 anchors with commit-first, district/region rollups, standing/1.
