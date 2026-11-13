# Conformance

An implementation may claim compatibility with this repository only if it passes all of the following.

1. **Payloads.** Every exact `body` in `protocols/dland/vectors/conformance.json` (including the raw JSON-profile cases `PROF-*`) and every claim case in `protocols/dogemaps/vectors/conformance.json` passes or fails as marked. Official ÐMaps geo cells (§7.5 and all 256 `geo_batch` heights), stake floors, H3 parents and `invalid_cells` match.
2. **Index state.** Replay `vectors/indexer-state.json` and produce the listed results, `delta` and `state_root` after every block, and the listed `snapshot_hash` where given ([docs/INDEXING.md](docs/INDEXING.md) §8). The reference driver is `reference/apply.mjs` + `reference/state.mjs`.
3. **Authorization.** The `authorize` and `cell` cases in the ÐLand vectors (unbound, not `i0`, no title, title mismatch, no title spend, same-tx title; commit-first, final cell, equal keys) match the spec and never mutate parcel state when rejected.
4. **Reorg.** Undoing the last block of the worked vector restores the previous root.
5. **API (if you expose HTTP).** Routes and shapes in [docs/API.md](docs/API.md) and [docs/openapi.yaml](docs/openapi.yaml). Snapshot `hash` is SHA-256 of the exact `checkpoint` text.

Dogex, as the reference indexer, MUST run the same JSON files in CI or a targeted unit test and MUST serve the documented endpoints once the protocols are activated on that node.

```bash
npm test
```
