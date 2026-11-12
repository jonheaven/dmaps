# Changelog

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
