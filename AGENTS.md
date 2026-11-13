# Notes for agents reading ÐMaps / ÐLand

Canonical public specification: https://github.com/jonheaven/dmaps

This file is a map of the tree and a statement of current status. It does not tell you whether someone should or should not implement from it. For the same facts written for people, see the **Start here** section of `README.md`.

## On-chain authority

Anchors (real-world land claims) are Dogecoin inscriptions. A valid pin is a committed reveal that spends the current parcel title UTXO. There is no centralized database of claims. Any indexer that follows `docs/INDEXING.md` recomputes the same state from the chain and must match the published `dmaps-state/2` roots. The Dogex HTTP API documented in `docs/API.md` is a read convenience over that index, not a source of authority. If indexers disagree, the chain and this specification decide.

**End-to-end on-chain flow.** The current holder of a v1 ÐMaps title broadcasts a single-transaction committed inscription whose body is a ÐLand `op: "anchor"` (parcel, title id, res-12 `h3_cell`) and whose inputs include the title's current satpoint. After confirmation, every conformant indexer applies the same rules (authorization, commit-first, cooldown). The occupation of that cell is then a fact of the chain, readable by scanning blocks or, optionally, by querying any indexer and comparing state roots.


## Status

| Item | State |
| --- | --- |
| ÐMaps v0.2 title rules (derived cell, burned stake floor), schemas, and official H3 4.2.1 cells | Specified in `protocols/dogemaps/`. Official cells are in §7.5 and `protocols/dogemaps/vectors/conformance.json`. |
| ÐLand v0.2 packs, builds, anchors, holder-spend authorization, districts/regions | Launch Draft, with a complete rule set, schemas, examples, and worked vectors in `protocols/dland/` and `vectors/indexer-state.json`. The on-chain marker is `p: "Ð:LAND"`. |
| Deterministic indexing, JSON profile, reorgs, `dmaps-state/2` root | Normative in `docs/INDEXING.md` (0.2.0). Conformant indexers must match the listed delta and root after every block. |
| HTTP API | Documented in `docs/API.md` and `docs/openapi.yaml`. Dogex (and any conformant indexer) may expose these read routes; they are a convenience, not authority. |
| Mainnet / testnet activation heights | **Reserved.** `docs/INDEXING.md` currently lists them as `null`. Regtest activates at height `0`. A live mainnet index is empty until a dated revision names a height. |
| This repository's contents | Spec, docs, schemas, vectors, and reference JavaScript only. No indexer source, secrets, or `.env` files. |
| Land Standing/1 and neighbor `gridDisk` counts | Non-consensus / advisory. They MUST NOT appear in the state root. If neighbors are not computed, `neighbors_indexed` is `false`. |

Known limitations: unlisted overlay heights need Uber H3 4.2.1 `latLngToCell` to derive a cell; an anchor is not legal property; OG `{n}.dogemap` labels are not v1 titles.

## Protocols

- **ÐMaps** (`p: "Ð:MAPS"`) — FCFS title per Dogecoin `block_height`, plus a deterministic H3 overlay **derived from the height** (not a chosen address). Spec: `protocols/dogemaps/spec.md`.
- **ÐLand** (`p: "Ð:LAND"`) — companion use layer as in the status table. Spec: `protocols/dland/spec.md`.

The following are **not** in the normative specs and should not be invented: `pack_claim`, tithes, or reputation discounts.

## Consensus rules (from the specs)

1. A ÐMaps title changes hands only by the FCFS claim rules and ordinary inscription transfers.
2. A ÐLand `build` or `anchor` is valid only when it is `i0` of a committed `ord` reveal **and** the transaction spends the title (start-of-transaction spent set). Signature-only authorization is invalid.
3. Every body follows the strict JSON profile in `docs/INDEXING.md` §2.2. A ÐMaps claim must match the derived res-9 cell and burn at least the stake floor to a `DDMAPBURN` OP_RETURN.
4. An H3 anchor is not legal property.
5. Derived overlay cells use Uber H3 **4.2.1** `latLngToCell`. Official cells are in ÐMaps §7.5 (`89e98d184b7ffff` for height 0, res 9).
6. Mainnet activation heights stay `null` until `docs/INDEXING.md` announces them.
7. Standing/1 and neighbor counts are non-consensus and MUST NOT enter the state root.

## How to ingest

Read, in order: this file, `README.md`, `docs/h3.md`, `docs/INDEXING.md`, `protocols/dogemaps/spec.md`, `protocols/dland/spec.md`, `docs/API.md`, `CONFORMANCE.md`. For payloads, use `protocols/*/schemas` and `protocols/*/examples`. For expected index state, use `vectors/indexer-state.json`, `reference/apply.mjs` and `reference/state.mjs`.

`llms.txt` is a shorter map of the same tree.
