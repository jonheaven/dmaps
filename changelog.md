# Changelog

## 0.3.0 — 2026-11-12

Design pass: ÐMaps 0.3, ÐLand 0.3, INDEXING 0.3.0, `dmaps-state/3`. The question was what the simplest protocol is that still keeps the one hard guarantee — **only the current holder, spending the title UTXO in the same transaction, can change a parcel** — and still recognizes every existing `<n>.dogemap` parcel. The answer is in the README's [Design principles](README.md#design-principles). Every change below is one of three things: an existing convention adopted, a knob removed, or a stored fact turned into a view.

### Decisions

| Item | Decision | Why |
| --- | --- | --- |
| `<n>.dogemap` text titles | **Changed** — now titles (exact bytes, `text/plain*` / `application/json*`, `n` ≤ height), sharing one first-wins slot with JSON claims | Existing parcels already work this way on chain and in existing dogemap indexes; a standard should build on them, not orphan them |
| JSON claim shape | **Changed** — only `p`, `op:"claim"`, `title.block_height` are read; `v`, `chain`, `tier`, `geo`, `fair` ignored | The cell is derived, so a supplied one can only be wrong; the other fields split nothing |
| Stake floor, `DDMAPBURN` burn, 2016-block claim window | **Removed** | A fee with a tunable curve over a moving window: consensus surface, makes validity depend on neighbours' activity, and existing dogemaps never paid it. The inscription is the cost |
| `params` op | **Removed** (stays removed) | A parameter feed is an admin key |
| `i0` / single-transaction rule for claims | **Removed** | Inscription order is already total; existing text titles were never `i0`-only. The strict carrier stays only where it protects someone (ÐLand parcel changes) |
| Title conflict rule | **Kept** — first inscription wins (not commit-first) | Keeps every existing parcel and the existing dogemap index's answer. Cells (scarce, chosen, mempool-visible) use commit-first |
| `upgrade` / `link` ops | **Removed** | No state, no authorization; holder-gated building is ÐLand `build` |
| Visual renderer, collector scoring | **Moved** to `docs/extensions/` | Optional, non-consensus; the core now fits on one page |
| Protocol versions (`v`) | **Removed** — `v` is not read in ÐMaps or ÐLand | No versions or activation splits inside the protocol |
| Activation heights | **Removed** from the protocol and the genesis root | Rules apply from block 0; an indexer's start height is an operator choice, not a rule |
| Re-anchor cooldown (144) | **Removed** | Commit-first is the only cell rule; every move already costs a title-spending transaction and cannot touch a final occupant |
| `seal_all` | **Removed** (ignored as an unknown key) | One `seal` per slot does the same; the parcel-wide flag was a second state machine |
| Per-slot `seal`, `remove` | **Kept** | The holder's own lock and undo |
| District Founder | **Changed** — derived on read (lowest live key in the district; `final` = key final at tip); no `D` records, no end-of-block settlement | A badge no rule reads should not be consensus state |
| Land Standing | **Kept non-consensus**, bumped to `land-standing/2` | Same formula; `is_founder` now reads the derived Founder |
| Packs | **Kept** — any inscription, multi-transaction allowed, written once | The pack id is the inscription id: nothing scarce to race |
| Build/anchor carrier | **Kept** — vin[0] content-bound `ord` envelope, `i0`, and the title spent at the start of the transaction | This is the hard guarantee |
| Commit-first for cells (W = 30) | **Kept** | Same rule as ÐNS; the only cell conflict rule |
| Chained state root | **Kept** as an audit commitment; no rule reads it | Cheap equality check between indexers; never a prerequisite for validity |
| State records | **Changed** — `T/P/B/C` only; `L` and `D` removed; `B` drops `applied`; `C` drops `from_commit` | A parcel's cell is the `C` record that names it; counters and provenance flags are informative |
| Holder endpoint | **Changed** — `GET /api/land/holder/{address}` is cursor-paged (`after` = block number, `limit`, `next`, `total`); `anchored` rows are `{parcel, h3_cell}` | The 500-title cap is gone |
| District list | **Changed** — `GET /api/land/districts` lists every district with a live anchor (cursor `region|district`) with `live_cells` and the derived `founder` | Founders are no longer stored |

### Compatibility and reindex

- `dmaps-state/3` and `dmaps-checkpoint/3` replace `/2`. Every root changes, including the genesis root (`SHA-256("dmaps-state/3\nnetwork=<net>\nh3=4.2.1\n")`). An index built under 0.2 must be rebuilt from genesis.
- Any 0.2-style JSON claim is still a claim (its extra fields are ignored). A 0.2 claim that would have failed on stake, burn, cell or `i0` may now be the title; a `.dogemap` text inscription earlier in order now wins over a later JSON claim.
- API: removed `seal_all`, `last_change`, `cooldown_remaining` (parcel and cell), `reanchor_cooldown` and `claim_window` (status), `founder_parcel` (districts), the `stake_floor`/`burn_output` capability flags. Added `founder.derived`, holder `next`/`total`. See [docs/API.md](docs/API.md) and [docs/openapi.yaml](docs/openapi.yaml) 0.4.

### Conformance

- `reference/dmaps-claim.mjs` is a two-form parser (`parseClaim(body, content_type, height)`). `reference/apply.mjs` has no end-of-block step. `protocols/dland/standing.mjs` adds `founderOf`.
- Vectors regenerated: claim cases `CLAIM-001…033` (text and JSON, media types, exact-bytes failures), ÐLand parse cases without `v`, `seal_all` ignored, and a block log with text and JSON titles, duplicates across forms, commit-first displacement, final-occupant rejection, and a cell released and reused in one block.

## 0.2.0 — 2026-11-12

Protocol revision. ÐMaps 0.2, ÐLand 0.2, INDEXING 0.2.0. Activation heights are still `null` on mainnet and testnet, so nothing that was live changes; any local index built with an override must be rebuilt from genesis.

**State commitment**
- `dmaps-checkpoint/1` (the full state rebuilt and hashed after every block) is replaced by `dmaps-state/2`: each block that changes state hashes only its delta onto the previous root, `root = SHA-256(prev_root LF delta_text)`. A block with no change keeps the root. The full text is now an on-demand snapshot, `dmaps-checkpoint/2`, with a `root=` line. New record `L` (parcel live cell, last change, seal_all). INDEXING §8.
- API: `GET /api/dmaps/state/root[/{height}]`, `GET /api/dmaps/state/delta/{height}`; `/api/dmaps/checkpoint/latest` serves the snapshot at the tip.

**One JSON profile** (INDEXING §2.2): strict UTF-8, no BOM, one object, no duplicate keys, integers only (no `-0`, |n| ≤ 2^53−1), no lone surrogates, depth ≤ 32, strict types, `null` never valid. Canonical inscription ids. Stored content is JCS.

**ÐMaps**
- A claim must be `i0` and whole in one transaction; `chain` is `"dogecoin"` on every network; `h3_res` is fixed at 9.
- Stake floor is the exact integer `10 × (1000 + min(G, 5000))²` koinu with `G` = titles confirmed in the previous 2016 blocks (same values as the 0.1 float formula).
- The stake must be burned to an output `OP_RETURN "DDMAPBURN" u64le(stake)` with value ≥ stake. Fee-as-stake is gone.
- Removed: `params` op, per-address caps, burst limits, top-level aliases.

**ÐLand**
- `build`/`anchor` must be `i0` in a bound `ord` envelope whose bound body equals the op body. `dog` envelopes do not carry ÐLand ops.
- The title spend is checked against the inscriptions carried by the transaction's inputs at the start of the transaction; a title created in the same transaction never authorizes.
- Full `isValidCell` on anchors; parents are `cellToParent` (the 0.1 bit-twiddle codec produced wrong parents for some cells).
- Displacement unanchors the loser. Re-anchoring to the same cell is a no-op. A seal without content keeps content. Pack names are stored verbatim. No bitwork.
- Founders are settled at the end of each block: the lowest live key in the district until that key is final, then permanent.
- District and region queries are indexed and cursor-paged (`next`); the 500-row caps are gone. Parcels return their title's res-9 cell.

**Conformance**
- New: `reference/json-profile.mjs`, `reference/dmaps-claim.mjs`, `reference/state.mjs`, `reference/make-vectors.mjs`. Removed: `reference/checkpoint.mjs`.
- All vector files are generated (`npm run vectors`) and `npm test` fails if they drift. New cases: raw profile `PROF-*`, claims `CLAIM-*`, floors, 256 `geo_batch` heights, H3 parents and invalid cells, a 15-block state log with displacement, founder finalization, seal_all and remove.
- `h3-js` 4.2.1 is now a pinned dependency (`npm install`).

## 0.1.4 — 2026-11-12

API documentation only. No protocol rule, schema, vector, or checkpoint changed.

- docs/API.md now matches what Dogex serves, field for field. Corrections:
  - Base URL is `https://dogex.command.dog` (was `explorer.command.dog`); the brief is at `/docs/dmaps`.
  - `GET /api/doginals/dogemaps/claims/{block}` (and `/r/dogemap/block/{block}`) returns `{ block_number, entries }` with 200 even when unclaimed. It was documented as a flat object with 404. `/api/land/parcel/{block}` is the route that 404s.
  - Title rows carry `sequence_number`, `inscription_number`, `claim_timestamp`, the §7 seed `lat`/`lon`, and `body`. Dogex does not return `h3_cell`/`h3_res`; compute the res-9 cell with h3-js 4.2.1.
  - Title pages accept `limit` (and `page_size`), default 50, max 500.
  - `standing` has no `score`; `cell` has no `missed` field; builds and anchors carry `parcel` and a paging `cursor`.
  - Errors are plain-text bodies. Indexer not loaded is 503, not 404.
  - Capabilities `land` / `activation` describe mainnet defaults; `/api/land/status` reports the running values.
- Documented routes added to Dogex: `GET /api/land/districts`, `GET /api/dmaps/checkpoint/latest` (and `/api/land/checkpoint/latest`), `after`/`limit` on `/api/land/builds`, a `cursor` on anchor rows, and `network`, `maps_live`, `land_live`, `maps_flag`, `land_flag`, `checkpoint_version`, `routes` on `/api/land/status`. These need a Dogex build that includes them; older builds answer 404/400 on the new routes.
- docs/openapi.yaml rewritten to the same contract with absolute `/api/...` paths, response schemas, and plain-text error responses.
- README and llms.txt point at the public base URL and `maps_live` / `land_live`.

## 0.1.3 — 2026-11-11

- README Start here, AGENTS.md, and llms.txt now state that anchors are fully on-chain (title UTXO spend, no centralized DB), that any indexer recomputes identical state from the chain, and that the Dogex API is a read convenience, not authority. Includes a short end-to-end on-chain flow.

## 0.1.2 — 2026-11-11

- AGENTS.md and llms.txt now state status and known limitations neutrally (frozen rules, reserved activation heights, what this repo does and does not contain). They no longer instruct readers' agents how to advise implementers.

## 0.1.1 — 2026-11-11

- README **Start here**: status table (frozen vs reserved), minimal dApp path (read Dogex API, inscribe an anchor), `npm test` as the conformance entry point.
- Replaced placeholder `<recomputed>` H3 cells in ÐMaps §15 examples with official H3 4.2.1 values, and extended the §7.5 official-cell table to match.
- Clarified that Launch Draft means “implement these rules”; only the mainnet activation height is still reserved. The on-chain marker remains `"p": "Ð:LAND"` until a dated revision.
- Scoped committed-envelope links that pointed at files not vendored in this repository.

## 0.1.0 — 2026-11-11

- First public canonical drop of ÐMaps v0.1 (Launch Draft), cleaned so schemas, examples, and official H3 4.2.1 cells match §6.1 / §7.
- ÐLand v0.1 Launch Draft: packs, holder-spend builds, res-12 anchors, commit-first, district/region flywheel, threat model.
- Normative `docs/INDEXING.md` with activation constants, reorg rules, and `dmaps-checkpoint/1`.
- Worked indexer-state vectors with expected checkpoint hashes.
- Dogex HTTP API documentation and OpenAPI for claims, parcels, packs, builds, anchors, cells, districts, holders, checkpoints.
- H3 primer, `AGENTS.md`, and `llms.txt`.
