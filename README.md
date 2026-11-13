# ÐMaps and ÐLand — canonical public specification

**This repository is the canonical public specification for ÐMaps (`p: "Ð:MAPS"`) and its companion ÐLand (`p: "Ð:LAND"`).** It is meant to be implemented against today. The rules, schemas, worked vectors, checkpoint hashes, and HTTP API are in this tree. You do not need indexer source, a rename, or a mainnet height to start building.

---

## Start here

Real-world land claims (**anchors**) are **fully on-chain**. Each pin is a Dogecoin inscription whose reveal spends the current ÐMaps parcel **title UTXO**. There is no centralized database, registrar, or application server that grants or stores the claim. Any conformant indexer recomputes **identical** protocol state from the chain and [docs/INDEXING.md](docs/INDEXING.md) alone, and MUST agree on the `dmaps-checkpoint/1` hash. The [Dogex HTTP API](docs/API.md) is a **read convenience** over that recomputed index — it is not an authority.

**End-to-end on-chain flow.** The holder of a v1 title (the inscription that first validly claimed a `block_height`) chooses a resolution-12 H3 cell and broadcasts a single-transaction *committed* inscription with a ÐLand `op: "anchor"` body that names that parcel, the title id, and the cell. The same transaction spends the title's current satpoint. Once the transaction is in a block, every indexer applies the same validity and commit-first rules; the cell is occupied (or the op is ignored if unauthorized, on cooldown, or beaten to the cell). A later reader can verify the pin by scanning the chain, or by asking any indexer and, if they want a second opinion, comparing checkpoint hashes. Disagreement is settled by the chain and this spec, not by a particular API host.

### What is stable now vs what is waiting

| Feature | Status | Implement today? |
| --- | --- | --- |
| ÐMaps titles (`op: "claim"`), FCFS per `block_height` | **Frozen rules** in [protocols/dogemaps/spec.md](protocols/dogemaps/spec.md). Schemas and official cells match §6.1 / §7.5 | **Yes** |
| Derived H3 overlay (default res 9), Uber H3 **4.2.1** | **Frozen.** Official cells: `(0,9)=89e98d184b7ffff`, `(1,9)=8901a2b054fffff`, `(12345,8)=88f166ced3fffff` | **Yes** |
| ÐLand packs, holder-gated builds, res-12 anchors, districts/regions | **Launch Draft, complete.** [protocols/dland/spec.md](protocols/dland/spec.md) has the threat model, auth, and ops. Worked state in [vectors/indexer-state.json](vectors/indexer-state.json) | **Yes** — treat `"p": "Ð:LAND"` as load-bearing |
| Holder authorization (spend current title UTXO + committed reveal) | **Frozen** | **Yes.** Signature-only auth is invalid |
| Deterministic indexing, reorgs, `dmaps-checkpoint/1` | **Normative** [docs/INDEXING.md](docs/INDEXING.md). Independent indexers MUST match these hashes | **Yes** (`npm test`) |
| Dogex HTTP API (claims, parcels, packs, builds, anchors, cells, districts, holders, checkpoints) | **Documented** in [docs/API.md](docs/API.md) and [docs/openapi.yaml](docs/openapi.yaml). Read convenience over a recomputed index, **not authority** | **Yes.** On mainnet the index is empty until a height is announced |
| Mainnet / testnet activation height | **Not announced** (`null` in INDEXING.md). Regtest = `0` | Indexers MUST stay idle on mainnet until a dated revision names a height. Use regtest or a local override for development only |
| Land Standing/1, neighbor `gridDisk` counts, district-majority skins | **Non-consensus / advisory.** Not in the checkpoint | Optional. If you cannot compute neighbors, set `neighbors_indexed: false` |
| Protocol display name “ÐLand” | Cosmetic. A rename would be a **dated revision with a new marker**, not a silent change | Do not invent a second marker. Emit `"p": "Ð:LAND"` |

**Launch Draft** means the rules here are the ones a conformant indexer and dApp must follow, with tests you can run in this repo. It is not a sketch and not a reason to wait. The one thing still reserved is the **mainnet activation height**. Breaking changes, if any, will appear as a dated changelog revision — not a silent rewrite.

### Minimal dApp path

A dApp that ties a parcel to a real-world place does two things: **read** the index, and (if the user holds the title) **inscribe an anchor**.

**1. Read** from any Dogex (or other conformant) indexer. All routes are read-only JSON; see [docs/API.md](docs/API.md). The public Dogex index is `https://dogex.command.dog` (one-page brief: [dogex.command.dog/docs/dmaps](https://dogex.command.dog/docs/dmaps)).

```http
GET /api/doginals/capabilities
GET /api/land/status
GET /api/doginals/r/dogemap/block/{block}
GET /api/land/parcel/{block}
GET /api/land/cell/{h3}
GET /api/land/holder/{address}
GET /api/dmaps/checkpoint/latest
```

Until `MAPS_ACTIVATION_HEIGHT` / `LAND_ACTIVATION_HEIGHT` are announced, mainnet responses are empty (activation disabled). On **regtest** they are live from height 0. Read `maps_live` / `land_live` from `GET /api/land/status` rather than hard-coding a height.

**2. Write an anchor** (current title holder only). The inscription body is the JSON in [protocols/dland/examples/anchor-valid.json](protocols/dland/examples/anchor-valid.json):

```json
{
  "p": "Ð:LAND",
  "v": "1",
  "op": "anchor",
  "parcel": 6197585,
  "title": "<current title inscription id>",
  "h3_res": 12,
  "h3_cell": "8c28308280f37ff"
}
```

The reveal transaction MUST:

1. Be a **single-transaction committed (content-binding) inscription** — [docs/committed-envelope.md](docs/committed-envelope.md).
2. **Spend the current title outpoint** (the satpoint of the ÐMaps v1 title at the start of that transaction). A leftover signature after a transfer is not authorization.
3. Use a res-12 H3 cell the holder chose. One live parcel per cell; commit-first (`W = 30`); re-anchor cooldown 144 blocks. An anchor is **not legal property**.

Builds use the same authorization, with [protocols/dland/examples/build-valid.json](protocols/dland/examples/build-valid.json), after a `pack` inscription exists. New titles use [protocols/dogemaps/examples/claim-valid.json](protocols/dogemaps/examples/claim-valid.json) (official cell `89e98d184b7ffff` for height 0, res 9).

**3. Confirm** on-chain (the inscription and the title spend are in a block) or, as a convenience, via `GET /api/land/parcel/{block}` and `GET /api/land/cell/{h3}`. Independent indexers can be checked against each other with `GET /api/dmaps/checkpoint/{height}` — the hash is SHA-256 of the checkpoint text derived from the chain, not a value issued by Dogex.

### Run the conformance tests

```bash
git clone https://github.com/jonheaven/dmaps.git
cd dmaps
npm test
```

No extra packages are required for `npm test` (Node 18+). To recompute official overlay cells yourself: `npm install h3-js@4.2.1` and use [reference/dmaps-geo.mjs](reference/dmaps-geo.mjs).

| You are… | Then read |
| --- | --- |
| New to H3 / parcels | [docs/h3.md](docs/h3.md), then [protocols/dogemaps/README.md](protocols/dogemaps/README.md) |
| Building a dApp | This section, then **[docs/API.md](docs/API.md)** and [docs/openapi.yaml](docs/openapi.yaml) |
| Building an indexer | **[docs/INDEXING.md](docs/INDEXING.md)**, [CONFORMANCE.md](CONFORMANCE.md), both specs, `vectors/` and `reference/` |
| An AI agent | [AGENTS.md](AGENTS.md) and [llms.txt](llms.txt) |

---

## What these protocols are

ÐMaps turns every Dogecoin block height into a transferable **title**, with a deterministic [H3](https://h3geo.org/) overlay **derived from that height**. ÐLand is an optional **expansion pack** layer on top of those titles: permissionless pack schemas, holder-gated builds that travel with the parcel, and a *chosen* real-world H3 pin (not legal property), with district/region rollups.

A third-party indexer that follows [docs/INDEXING.md](docs/INDEXING.md) MUST produce the **same state and the same checkpoint hash** as the reference implementation (Dogex) at every height.

| | |
| ---: | --- |
| **ÐMaps** | v0.1, [protocols/dogemaps/spec.md](protocols/dogemaps/spec.md) |
| **ÐLand** | v0.1 Launch Draft, [protocols/dland/spec.md](protocols/dland/spec.md) |
| **Indexing** | [docs/INDEXING.md](docs/INDEXING.md) |
| **Conformance** | [CONFORMANCE.md](CONFORMANCE.md), [vectors/indexer-state.json](vectors/indexer-state.json) |
| **HTTP API** | [docs/API.md](docs/API.md), [docs/openapi.yaml](docs/openapi.yaml) |
| **H3 primer** | [docs/h3.md](docs/h3.md) |
| **Chain** | Dogecoin |
| **License** | [MIT](LICENSE) |

This repo is **spec, docs, schemas, vectors, and reference JavaScript only**. It does not contain indexer source, secrets, or `.env` files.

## Authors

Jon Heaven — GitHub [@jonheaven](https://github.com/jonheaven) · X [@jontype](https://x.com/jontype)

If you ship this in a wallet, metaverse, or indexer, emit exactly `"p": "Ð:MAPS"` and `"p": "Ð:LAND"` and keep the op shapes identical, so every indexer sees one title set and one land-use layer.

## Relationship (superset, no broken claims)

Bitcoin Bitmaps (and OG `{n}.dogemap` labels) associate a block number with a title-like inscription. ÐMaps keeps that idea as the **base claim**, with stricter indexer rules and a derived H3 overlay. Bitmaps do not specify holder-gated builds, typed expansion packs, or a unique chosen real-world pin. ÐLand adds those **without changing who won a ÐMaps title**. A holder who does nothing still has a valid parcel.

ÐGPS (presence / findable places) and ÐMP (marketplace) are separate public specs. An anchor MAY reference a ÐGPS `place`. Trading uses ÐMP against the **title** inscription; LAND state follows it automatically.

## Security (ÐLand)

Only the **current holder** can change a parcel's LAND config, by **spending the current title UTXO** in a content-binding (committed) reveal. A leftover signature after a transfer is not enough. See ÐLand [spec.md §3](protocols/dland/spec.md#3-threat-model-normative) and §6.
