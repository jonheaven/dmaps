# ÐMaps (block titles)

**ÐMaps** is the first `<n>.dogemap` inscription per Dogecoin block height (or the JSON claim with `p:"Ð:MAPS"`, `op:"claim"`, `title.block_height`). Holding it is owning it. Each title has a deterministic H3 cell derived from its height.

This folder is the normative ÐMaps v0.3 specification (rules apply from the first block; no activation or version split). Building *on* parcels (expansion packs, holder-gated state, *chosen* real-world pins) is **ÐLand** (`p: "Ð:LAND"`): [../dland/](../dland/).

- **[spec.md](spec.md)** — Normative protocol
- **[schemas/](schemas/)** — JSON Schema for the JSON claim (aligned with §1)
- **[vectors/](vectors/)** — Claim and geo-cell vectors
- **[examples/](examples/)** — Valid JSON claim and exact text claim (no newline)
- Shared indexing, reorgs, and state hashes: [../../docs/INDEXING.md](../../docs/INDEXING.md)
- H3 primer: [../../docs/h3.md](../../docs/h3.md)

Existing `<n>.dogemap` plain-text inscriptions **are titles**, sharing one first-wins slot with JSON claims. No stake or burn.

H3 cells in this protocol are **derived** (hash of the block height), not chosen. Chosen pins are ÐLand anchors.

*H3 is from [Uber H3](https://github.com/uber/h3) v4.2.1 (Apache-2.0 for the library).*
