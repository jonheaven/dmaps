# ÐLand (expansion packs, builds, and real-world anchors)

**Status: Launch Draft (v0.3)** — complete rules, schemas, and vectors. The protocol has no activation height or version split: it applies from the first block. The marker `"p": "Ð:LAND"` and holder-spend authorization are load-bearing.

**Normative spec:** [spec.md](spec.md)

ÐLand is a companion to [ÐMaps](../dogemaps/README.md). ÐMaps stays the canonical FCFS block-title protocol. ÐLand is the optional use layer:

- **Packs** — permissionless schemas (pack id = inscription id); any inscription, multi-tx allowed. No registry, no fee.
- **Builds** — holder-gated, pack-typed state. Travels with the title. Supersede / remove / seal.
- **Anchors** — the holder pins a *chosen* H3 cell at resolution 12. One parcel per cell, commit-first (same rule as ÐNS). Not legal property.
- **Districts / regions** — pins roll up to H3 res 7 and res 4. Founder = the lowest live key in the district (derived on read, non-consensus, not a privilege).

Hardening is non-negotiable: only the current title holder can change a parcel's LAND config, by spending the current title UTXO in a committed reveal. See [spec.md §3](spec.md#3-threat-model-normative) and §6.

Shared indexing, JSON profile, and state root: [../../docs/INDEXING.md](../../docs/INDEXING.md). HTTP: [../../docs/API.md](../../docs/API.md).

```bash
# from the repo root
npm test
```

