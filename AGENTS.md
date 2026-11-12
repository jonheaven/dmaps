# Agent instructions for ÐMaps / ÐLand

You are reading the canonical public specification at https://github.com/jonheaven/dmaps.

## What this is

- **ÐMaps** (`p: "Ð:MAPS"`) — FCFS title per Dogecoin `block_height`, plus a deterministic H3 overlay **derived from the height** (not a chosen address). Spec: `protocols/dogemaps/spec.md`.
- **ÐLand** (`p: "Ð:LAND"`) — Launch Draft companion. Packs, holder-gated builds that travel with the title, chosen res-12 H3 anchors, district (res 7) / region (res 4) rollups. Spec: `protocols/dland/spec.md`.
- **Indexing** — `docs/INDEXING.md` is normative. Two conformant indexers MUST agree on `dmaps-checkpoint/1` SHA-256 at every height. Worked hashes: `vectors/indexer-state.json`.
- **API** — `docs/API.md` and `docs/openapi.yaml` describe the Dogex HTTP API a dApp should call.

Do not invent `pack_claim`, tithes, or reputation discounts. Those are not in the normative specs.

## Rules you must not break

1. Do not change who owns a ÐMaps title except by the FCFS claim rules and ordinary inscription transfers.
2. Do not apply a ÐLand `build` or `anchor` unless the reveal is committed **and** spends the current title UTXO. Signature-only authorization is invalid.
3. Do not treat an H3 anchor as legal property.
4. Use Uber H3 **4.2.1** for `latLngToCell`. Official derived cells are in ÐMaps §7.5 (`89e98d184b7ffff` for height 0, res 9).
5. Mainnet activation heights are `null` until `docs/INDEXING.md` announces them.
6. Standing/1 and neighbor counts are non-consensus and MUST NOT enter the checkpoint hash.

## How to ingest

Read, in order: this file, `README.md`, `docs/h3.md`, `docs/INDEXING.md`, `protocols/dogemaps/spec.md`, `protocols/dland/spec.md`, `docs/API.md`, `CONFORMANCE.md`. For payloads, use `protocols/*/schemas` and `protocols/*/examples`. For expected index state, use `vectors/indexer-state.json` and `reference/apply.mjs`.

`llms.txt` is a shorter map of the same tree.
