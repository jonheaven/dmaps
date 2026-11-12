# ÐMaps and ÐLand — canonical public specification

**This repository is the canonical public specification for ÐMaps (`p: "Ð:MAPS"`) and its companion ÐLand (`p: "Ð:LAND"`).**

ÐMaps turns every Dogecoin block height into a transferable **title**, with a deterministic [H3](https://h3geo.org/) overlay derived from that height. ÐLand is an optional **expansion pack** layer on top of those titles: permissionless pack schemas, holder-gated builds that travel with the parcel, and a *chosen* real-world H3 pin (not legal property), with district/region rollups.

A third-party indexer that follows [docs/INDEXING.md](docs/INDEXING.md) MUST produce the **same state and the same checkpoint hash** as the reference implementation (Dogex) at every height. dApps talk to that indexer through [docs/API.md](docs/API.md).

| | |
| ---: | --- |
| **ÐMaps** | Launch draft v0.1, [protocols/dogemaps/spec.md](protocols/dogemaps/spec.md). FCFS per `block_height`. Official H3 4.2.1 cells in §7.5 |
| **ÐLand** | **Launch Draft** v0.1, [protocols/dland/spec.md](protocols/dland/spec.md). Packs, builds, anchors. The name is renameable |
| **Indexing** | [docs/INDEXING.md](docs/INDEXING.md) — order, validity, reorgs, activation constants, `dmaps-checkpoint/1` |
| **Conformance** | [CONFORMANCE.md](CONFORMANCE.md), [vectors/indexer-state.json](vectors/indexer-state.json) |
| **HTTP API** | [docs/API.md](docs/API.md), [docs/openapi.yaml](docs/openapi.yaml) |
| **H3 primer** | [docs/h3.md](docs/h3.md) |
| **Chain** | Dogecoin |
| **License** | [MIT](LICENSE) |

This repo is **spec, docs, schemas, vectors, and reference JavaScript only**. It does not contain indexer source, secrets, or `.env` files.

Mainnet activation heights are **disabled (`null`)** until a dated revision of `docs/INDEXING.md` announces them. Regtest activates at height `0`.

## Authors

Jon Heaven — GitHub [@jonheaven](https://github.com/jonheaven) · X [@jontype](https://x.com/jontype)

If you ship this in a wallet, metaverse, or indexer, emit exactly `"p": "Ð:MAPS"` and `"p": "Ð:LAND"` and keep the op shapes identical, so every indexer sees one title set and one land-use layer.

## Start here

| You are… | Read |
| --- | --- |
| **New to H3 / parcels** | [docs/h3.md](docs/h3.md), then the ÐMaps README |
| **Building an indexer** | **[docs/INDEXING.md](docs/INDEXING.md)**, [CONFORMANCE.md](CONFORMANCE.md), then both specs |
| **Building a dApp** | **[docs/API.md](docs/API.md)** and [docs/openapi.yaml](docs/openapi.yaml) |
| **An AI agent** | [AGENTS.md](AGENTS.md) and [llms.txt](llms.txt) |
| **Need JSON today** | [protocols/dogemaps/examples/](protocols/dogemaps/examples/), [protocols/dland/examples/](protocols/dland/examples/) |

```bash
npm test
# optional, official overlay cells:
# npm install h3-js@4.2.1 && node --input-type=module -e "import * as h3 from 'h3-js'; import { dogemapsH3, OFFICIAL_CELLS } from './reference/dmaps-geo.mjs'; ..."
```

## Relationship (superset, no broken claims)

Bitcoin Bitmaps (and OG `{n}.dogemap` labels) associate a block number with a title-like inscription. ÐMaps keeps that idea as the **base claim**, with stricter indexer rules and a derived H3 overlay. Bitmaps do not specify holder-gated builds, typed expansion packs, or a unique chosen real-world pin. ÐLand adds those **without changing who won a ÐMaps title**. A holder who does nothing still has a valid parcel.

ÐGPS (presence / findable places) and ÐMP (marketplace) are separate public specs. An anchor MAY reference a ÐGPS `place`. Trading uses ÐMP against the **title** inscription; LAND state follows it automatically.

## Security (ÐLand)

Only the **current holder** can change a parcel's LAND config, by **spending the current title UTXO** in a content-binding (committed) reveal. A leftover signature after a transfer is not enough. See ÐLand [spec.md §3](protocols/dland/spec.md#3-threat-model-normative) and §6.
