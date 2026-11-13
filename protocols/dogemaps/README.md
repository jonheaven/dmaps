# ÐMaps (block titles)

**ÐMaps** (`p: "Ð:MAPS"`) is the canonical FCFS block-height title protocol for Dogecoin, with a deterministic H3 overlay derived from `block_height`. The familiar label is `<height>.dogemap` (e.g. `5000000.dogemap`).

This folder is the normative ÐMaps v0.2 specification (rules frozen; mainnet height not yet announced). Building *on* parcels (expansion packs, holder-gated state, *chosen* real-world pins) is **ÐLand** (`p: "Ð:LAND"`): [../dland/](../dland/).

- **[spec.md](spec.md)** — Normative protocol
- **[schemas/](schemas/)** — JSON Schema for operations (aligned with §6.1)
- **[vectors/](vectors/)** — Structural and geo-cell vectors
- **[examples/](examples/)** — Valid claim shape
- Shared indexing, reorgs, activation, and state hashes: [../../docs/INDEXING.md](../../docs/INDEXING.md)
- H3 primer: [../../docs/h3.md](../../docs/h3.md)

OG `{n}.dogemap` plain-text inscriptions are cultural (`badge: OG legacy`). A valid v1 `claim` is the canonical title for that height.

H3 cells in this protocol are **derived** (hash of the block height), not chosen. Chosen pins are ÐLand anchors.

*H3 is from [Uber H3](https://github.com/uber/h3) v4.2.1 (Apache-2.0 for the library).*
