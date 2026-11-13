# Changelog

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
