# Conformance

An implementation may claim compatibility with this repository only if it passes all of the following.

1. **Payloads.** JSON fixtures in `protocols/dogemaps/vectors/conformance.json` and `protocols/dland/vectors/conformance.json` parse (or fail) as marked. Official ÐMaps geo cells match §7.5.
2. **Index state.** Replay `vectors/indexer-state.json` and emit the listed `checkpoint_hash` at every height, using the `dmaps-checkpoint/1` bytes in [docs/INDEXING.md](docs/INDEXING.md) §8. The reference driver is `reference/apply.mjs` + `reference/checkpoint.mjs` (`npm test`).
3. **Authorization.** T1–T5 in the ÐLand vectors (non-holder, stale-holder, unbound, title mismatch, replay / spent outpoint) never mutate parcel state. T6–T8 (commit-first, final cell, reorg) match the spec.
4. **Reorg.** Rolling back the last block of the worked vector restores the previous height's hash.
5. **API (if you expose HTTP).** Routes and shapes in [docs/API.md](docs/API.md) and [docs/openapi.yaml](docs/openapi.yaml). Checkpoint `hash` is SHA-256 of the exact `checkpoint` text.

Dogex, as the reference indexer, MUST run the same JSON files in CI or a targeted unit test and MUST serve the documented endpoints once the protocols are activated on that node.

```bash
npm test
```
