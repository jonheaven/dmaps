# Notes for agents reading ÐMaps / ÐLand

Canonical public specification: https://github.com/jonheaven/dmaps

This file is a map of the tree and a statement of current status. It does not tell you whether someone should or should not implement from it. For the same facts written for people, see the **Start here** section of `README.md`.

## Status

| Item | State |
| --- | --- |
| ÐMaps v0.1 title rules, schemas, and official H3 4.2.1 cells | Specified in `protocols/dogemaps/`. Official cells are in §7.5 and `protocols/dogemaps/vectors/conformance.json`. |
| ÐLand v0.1 packs, builds, anchors, holder-spend authorization, districts/regions | Launch Draft, with a complete rule set, schemas, examples, and worked vectors in `protocols/dland/` and `vectors/indexer-state.json`. The on-chain marker is `p: "Ð:LAND"`. |
| Deterministic indexing, reorgs, `dmaps-checkpoint/1` | Normative in `docs/INDEXING.md`. Conformant indexers must match the listed checkpoint hashes. |
| HTTP API | Documented in `docs/API.md` and `docs/openapi.yaml` (the Dogex contract). |
| Mainnet / testnet activation heights | **Reserved.** `docs/INDEXING.md` currently lists them as `null`. Regtest activates at height `0`. A live mainnet index is empty until a dated revision names a height. |
| This repository's contents | Spec, docs, schemas, vectors, and reference JavaScript only. No indexer source, secrets, or `.env` files. |
| Land Standing/1 and neighbor `gridDisk` counts | Non-consensus / advisory. They MUST NOT appear in the checkpoint hash. If neighbors are not computed, `neighbors_indexed` is `false`. |

Known limitations: unlisted overlay heights need Uber H3 4.2.1 `latLngToCell` to derive a cell; an anchor is not legal property; OG `{n}.dogemap` labels are not v1 titles.

## Protocols

- **ÐMaps** (`p: "Ð:MAPS"`) — FCFS title per Dogecoin `block_height`, plus a deterministic H3 overlay **derived from the height** (not a chosen address). Spec: `protocols/dogemaps/spec.md`.
- **ÐLand** (`p: "Ð:LAND"`) — companion use layer as in the status table. Spec: `protocols/dland/spec.md`.

The following are **not** in the normative specs and should not be invented: `pack_claim`, tithes, or reputation discounts.

## Consensus rules (from the specs)

1. A ÐMaps title changes hands only by the FCFS claim rules and ordinary inscription transfers.
2. A ÐLand `build` or `anchor` is valid only when the reveal is committed **and** spends the current title UTXO. Signature-only authorization is invalid.
3. An H3 anchor is not legal property.
4. Derived overlay cells use Uber H3 **4.2.1** `latLngToCell`. Official cells are in ÐMaps §7.5 (`89e98d184b7ffff` for height 0, res 9).
5. Mainnet activation heights stay `null` until `docs/INDEXING.md` announces them.
6. Standing/1 and neighbor counts are non-consensus and MUST NOT enter the checkpoint hash.

## How to ingest

Read, in order: this file, `README.md`, `docs/h3.md`, `docs/INDEXING.md`, `protocols/dogemaps/spec.md`, `protocols/dland/spec.md`, `docs/API.md`, `CONFORMANCE.md`. For payloads, use `protocols/*/schemas` and `protocols/*/examples`. For expected index state, use `vectors/indexer-state.json` and `reference/apply.mjs`.

`llms.txt` is a shorter map of the same tree.
