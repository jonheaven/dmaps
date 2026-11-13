# Notes for agents reading ÐMaps / ÐLand

Canonical public specification: https://github.com/jonheaven/dmaps

This file is a map of the tree and a statement of current status. It does not tell you whether someone should or should not implement from it. For the same facts written for people, see the **Start here** section of `README.md`.

## On-chain authority

Anchors (real-world land claims) are Dogecoin inscriptions. A valid pin is a committed reveal that spends the current parcel title UTXO. There is no centralized database of claims. Any indexer that follows `docs/INDEXING.md` recomputes the same state from the chain and must match the published `dmaps-state/3` roots. The Dogex HTTP API documented in `docs/API.md` is a read convenience over that index, not a source of authority. If indexers disagree, the chain and this specification decide.

**End-to-end on-chain flow.** The current holder of a ÐMaps title broadcasts a single-transaction committed inscription whose body is a ÐLand `op: "anchor"` (parcel, title id, res-12 `h3_cell`) and whose inputs include the title's current satpoint. After confirmation, every conformant indexer applies the same rules (authorization, commit-first). The occupation of that cell is then a fact of the chain, readable by scanning blocks or, optionally, by querying any indexer and comparing state roots.


## Status

| Item | State |
| --- | --- |
| ÐMaps v0.3 title rules (first `<n>.dogemap` or JSON claim per height wins; no stake), schemas, and official H3 4.2.1 cells | Specified in `protocols/dogemaps/`. Official cells are in §4.5 and `protocols/dogemaps/vectors/conformance.json`. |
| ÐLand v0.3 packs, builds, anchors, holder-spend authorization, districts/regions | Launch Draft, with a complete rule set, schemas, examples, and worked vectors in `protocols/dland/` and `vectors/indexer-state.json`. The on-chain marker is `p: "Ð:LAND"`. |
| Deterministic indexing, JSON profile, reorgs, `dmaps-state/3` root (records `T/P/B/C`) | Normative in `docs/INDEXING.md` (0.3.0). Conformant indexers must match the listed delta and root after every block. |
| HTTP API | Documented in `docs/API.md` and `docs/openapi.yaml`. Dogex (and any conformant indexer) may expose these read routes; they are a convenience, not authority. |
| Activation heights | **None in the protocol.** Rules apply from block 0 on every network. Dogex's activation env vars are an operator switch (off on mainnet by default), not protocol. |
| This repository's contents | Spec, docs, schemas, vectors, and reference JavaScript only. No indexer source, secrets, or `.env` files. |
| District Founder, Land Standing/2 and neighbor `gridDisk` counts | Non-consensus, derived on read. They MUST NOT appear in the state root. If neighbors are not computed, `neighbors_indexed` is `false`. |

Known limitations: unlisted overlay heights need Uber H3 4.2.1 `latLngToCell` to derive a cell; an anchor is not legal property. Existing `<n>.dogemap` text inscriptions ARE titles (first per height).

## Protocols

- **ÐMaps** (`<n>.dogemap` or `p: "Ð:MAPS"`) — first-inscription title per Dogecoin `block_height`, plus a deterministic H3 overlay **derived from the height** (not a chosen address). Spec: `protocols/dogemaps/spec.md`.
- **ÐLand** (`p: "Ð:LAND"`) — companion use layer as in the status table. Spec: `protocols/dland/spec.md`.

The following are **not** in the normative specs and should not be invented: `pack_claim`, tithes, reputation discounts, stakes, burns, cooldowns, `seal_all`, `params`, or protocol versions.

## Consensus rules (from the specs)

1. A ÐMaps title is the first `<n>.dogemap` (exact bytes) or JSON claim (`p`, `op:"claim"`, `title.block_height`) for `n`, with a `text/plain*` or `application/json*` content type and `n` ≤ confirmation height. It changes hands only by ordinary inscription transfers.
2. A ÐLand `build` or `anchor` is valid only when it is `i0` of a committed `ord` reveal **and** the transaction spends the title (start-of-transaction spent set). Signature-only authorization is invalid.
3. Every JSON body follows the strict JSON profile in `docs/INDEXING.md` §2.2. Keys a spec does not name (including `v`) are ignored.
4. An H3 anchor is not legal property.
5. Derived overlay cells use Uber H3 **4.2.1** `latLngToCell`. Official cells are in ÐMaps §4.5 (`89e98d184b7ffff` for height 0, res 9).
6. Commit-first (W = 30) is the only cell rule. There is no cooldown.
7. The Founder, Standing/2 and neighbor counts are non-consensus and MUST NOT enter the state root.

## How to ingest

Read, in order: this file, `README.md`, `docs/h3.md`, `docs/INDEXING.md`, `protocols/dogemaps/spec.md`, `protocols/dland/spec.md`, `docs/API.md`, `CONFORMANCE.md`. For payloads, use `protocols/*/schemas` and `protocols/*/examples`. For expected index state, use `vectors/indexer-state.json`, `reference/apply.mjs` and `reference/state.mjs`.

`llms.txt` is a shorter map of the same tree.
