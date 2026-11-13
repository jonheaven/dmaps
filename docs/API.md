# Dogex HTTP API for ÐMaps and ÐLand

This is the read API a dApp uses to show ÐMaps parcels and ÐLand packs, builds, and anchors. It describes what Dogex serves today, route for route and field for field.

**The chain is the authority, not this API.** Every title and every ÐLand op is a Dogecoin inscription. Any indexer that follows [INDEXING.md](INDEXING.md) reaches the same state from the same blocks, and two indexers can compare the `dmaps-state/2` root at any height. Dogex is one such reader. Treat its answers as a convenience, and compare state roots (or a second indexer) when it matters.

## Base URL

| Host | Use |
| --- | --- |
| `https://dogex.command.dog` | Public Dogex index (mainnet) |
| `https://dogex.command.dog/docs/dmaps` | One-page brief with live links |
| `https://dogex.command.dog/#dland` | Console: parcel / cell / pack / holder lookup, state root, snapshot, packs, builds, anchors |
| `http://127.0.0.1:8080` | A self-hosted `dogexd` (default listen) |

No API key. CORS is open. Every route is `GET`, read-only, and returns `application/json`. Send `Accept: application/json`.

Conventions: heights and parcel numbers are decimal integers. Inscription ids are `<64 lowercase hex>i<n>`. H3 indexes are lowercase hex with no `0x` and no leading zeros. Addresses are Dogecoin base58.

## Activation: read this before you trust an empty answer

`maps_activation_height` and `land_activation_height` are `null` until a mainnet height is announced in [INDEXING.md](INDEXING.md). While a height is `null`, Dogex indexes nothing for that protocol on that network: title lists are empty, `parcel` lookups return 404, the state root stays the genesis root, and pack/build/anchor lists are empty. That is expected, not an outage. On regtest both are `0` (live from genesis).

Always read `GET /api/land/status` first and check `maps_live` / `land_live` before you tell a user that a parcel or cell is unclaimed. An operator can set a height early with `DOGEX_DOGEMAP_ACTIVATION_HEIGHT` / `DOGEX_LAND_ACTIVATION_HEIGHT`; `/api/land/status` always reports the value the process is using.

## Errors

An error is an HTTP status with a short **plain-text** body (not JSON).

| Status | When |
| --- | --- |
| 400 | A path value does not parse: height, inscription id, H3 string, or address |
| 404 | No title for that height, unknown pack, or a height above the indexed tip |
| 503 | The inscription indexer is not loaded on this host (body `doginals disabled (pure node mode)`) |

Unknown query parameters are ignored.

## Paging

| Routes | Style |
| --- | --- |
| `/api/doginals/dogemaps/claims` | `offset` (count of titles) and `limit` (default 50, max 500). `page_size` is accepted as a synonym for `limit` |
| `/api/land/packs`, `/builds`, `/anchors`, `/districts`, `/district/{h3}`, `/region/{h3}` | Cursor. The response has `next` (`null` on the last page); pass it as `after=` for the next page. `after` is exclusive. Rows also carry their own `cursor`. `limit` default 100, max 500. Every list is served from an index, so nothing is capped: page until `next` is `null` |

## Status

`GET /api/land/status`

```json
{
  "protocol": "Ð:LAND",
  "network": "dogecoin",
  "tip": 5900000,
  "maps_activation_height": null,
  "land_activation_height": null,
  "maps_live": false,
  "land_live": false,
  "maps_flag": true,
  "land_flag": true,
  "state_version": "dmaps-state/2",
  "checkpoint_version": "dmaps-checkpoint/2",
  "state_root": "<64 hex>",
  "state_root_height": null,
  "routes": ["GET /api/land/status", "GET /api/land/parcel/{block}", "…"],
  "window": 30,
  "reanchor_cooldown": 144,
  "claim_window": 2016,
  "h3": "4.2.1",
  "h3_res": 12,
  "district_res": 7,
  "region_res": 4,
  "maps_h3_res": 9,
  "neighbors_indexed": false
}
```

`network` is `dogecoin`, `testnet`, or `regtest`. `maps_live` / `land_live` are `true` once the height is set and `tip` has reached it. `maps_flag` / `land_flag` are `false` when the operator turned the protocol off for this process. `state_root` is the current `dmaps-state/2` root and `state_root_height` the last height that changed it (`null` = still the genesis root).

## Capabilities

`GET /api/doginals/capabilities` is a feature probe for the whole indexer. `network`, the `land` object and the `activation` block describe the network this node indexes.

```json
{
  "schema": "dogex.doginals.capabilities/1",
  "committed_envelope": { "verify": true },
  "dns_commit_first": { "supported": true },
  "network": "dogecoin",
  "land": {
    "supported": true,
    "network": "dogecoin",
    "marker": "Ð:LAND",
    "maps_marker": "Ð:MAPS",
    "h3": "4.2.1",
    "h3_res": 12,
    "district_res": 7,
    "region_res": 4,
    "holder_spend": true,
    "commit_first": true,
    "strict_json_profile": true,
    "claim_validity": { "derived_cell": true, "stake_floor": true, "burn_output": true },
    "state_version": "dmaps-state/2",
    "checkpoint_version": "dmaps-checkpoint/2",
    "paginated_districts": true,
    "maps_h3_res": 9,
    "neighbors_indexed": false,
    "activation": { "maps_activation_height": null, "land_activation_height": null, "commit_window_blocks": 30 }
  },
  "activation": {
    "commit_window_blocks": 30,
    "mod_activation_height": null,
    "box_activation_height": null,
    "maps_activation_height": null,
    "land_activation_height": null
  }
}
```

(Other top-level fields such as `version` and `doginals_js_chain` are omitted here.)

## ÐMaps titles

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/doginals/dogemaps/claims?offset=&limit=` | `{ claims, total, offset, page_size, limit }`, titles in block-height order |
| GET | `/api/doginals/dogemaps/claims/{block}` | `{ block_number, entries }` for one height |
| GET | `/api/doginals/r/dogemap/block/{block}` | Same as the row above |
| GET | `/api/doginals/r/dogemap/list` | Same as `/claims` |
| GET | `/api/doginals/r/dogemap/count` | `{ "count": N }` |
| GET | `/api/doginals/address/{address}/dogemaps` | Titles the address holds now |

Only canonical v1 titles (`p: "Ð:MAPS"`, `op: "claim"`, first valid claim per height under [INDEXING.md §4](INDEXING.md): derived cell, stake floor, burn output) appear. Legacy `{n}.dogemap` text never takes a title slot.

`GET /api/doginals/dogemaps/claims/0`:

```json
{
  "block_number": 0,
  "entries": [
    {
      "block_number": 0,
      "inscription_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0",
      "sequence_number": 12,
      "inscription_number": 12,
      "claim_height": 100,
      "claim_timestamp": 1760000000,
      "lat": -68.90142302960157,
      "lon": -91.75832798704505,
      "body": "earth",
      "h3_res": 9,
      "h3_cell": "89e98d184b7ffff"
    }
  ]
}
```

`entries` is `[]` when the height has no title; this route returns 200 either way. `/api/land/parcel/{block}` is the route that answers 404 for an unclaimed height.

`lat` / `lon` are the [ÐMaps §7](../protocols/dogemaps/spec.md) seed for that height at resolution 9, and `h3_cell` is `latLngToCell(lat, lon, 9)`, byte-identical to h3-js 4.2.1 (Dogex uses the h3o crate, checked against h3-js on the published vectors). Height 0 gives `89e98d184b7ffff`; see [h3.md](h3.md) and `reference/dmaps-geo.mjs`.

`GET /api/doginals/address/{address}/dogemaps`:

```json
{
  "address": "D…",
  "dogemaps": [
    {
      "block_number": 0,
      "inscription_id": "aaaa…i0",
      "inscriptionid": "aaaa…i0",
      "label": "0",
      "gallery": "maps",
      "owner": "D…",
      "claim_height": 100,
      "claim_timestamp": 1760000000
    }
  ],
  "total": 1
}
```

## Parcels

`GET /api/land/parcel/{block}`

```json
{
  "protocol": "Ð:LAND",
  "parcel": 0,
  "title": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0",
  "title_h3": { "h3_res": 9, "h3_cell": "89e98d184b7ffff" },
  "holder": "D…",
  "builds": [
    {
      "pack": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbi0",
      "pack_name": "street-scene",
      "content": { "model": "ipfs://z" },
      "content_sha256": "<64 hex of the JCS content>",
      "sealed": false,
      "applied": 1,
      "last_build": "1111…i0",
      "last_height": 102,
      "parcel": 0,
      "cursor": "…"
    }
  ],
  "builds_next": null,
  "anchor": {
    "h3_cell": "8c28308280f37ff",
    "h3_res": 12,
    "district": "872830828ffffff",
    "region": "8428309ffffffff",
    "status": "pending",
    "final_after_height": 133,
    "priority": { "height": 103, "tx_index": 0, "vout": 0 },
    "from_commit": true,
    "anchor_id": "cccc…i0",
    "parcel": 0,
    "cooldown_remaining": 0
  },
  "seal_all": false,
  "last_change": 103,
  "cooldown_remaining": 0,
  "is_founder": true,
  "standing": { "version": "land-standing/1", "neighbors_indexed": false }
}
```

- `holder` is the address holding the title inscription now (not the address that claimed it). `null` if the indexer cannot place it.
- `anchor` is `null` when the parcel has no live anchor. `status` is `pending` until the anchor is more than `window` (30) blocks deep, then `final`. `final_after_height` is the last height at which it can still be displaced. `cooldown_remaining` is blocks until the holder may re-anchor (144-block cooldown); `last_change` is the height of the last cell change.
- `builds` is the first page (100) of the parcel's slots; `builds_next` is the cursor for `/api/land/builds?parcel=…&after=` when there are more. `title_h3` is the title's derived res-9 cell.
- `is_founder` is `true` when this parcel founded its res-7 district.
- `standing` is advisory and not in the state root. Dogex does not compute a `score` or neighbor counts (`neighbors_indexed: false`).
- 404 when the height has no canonical title.

## Packs

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/land/packs?after=&limit=` | `{ packs: [{ id, name, version, height, cursor }], next }` in id order |
| GET | `/api/land/packs/{id}` | One pack, or 404 |

`GET /api/land/packs/{id}`:

```json
{
  "id": "bbbb…i0",
  "name": "street-scene",
  "version": "1",
  "height": 101,
  "schema": { "type": "object" },
  "schema_uri": null,
  "note": null,
  "supersedes": null
}
```

## Builds

`GET /api/land/builds?parcel=&pack=&after=&limit=` → `{ builds: [build], next }`. Each build has the same fields as in `parcel.builds`. Filter by `parcel`, by `pack`, or both. `limit` bounds the scan before the `pack` filter, so a filtered page can be shorter than `limit`; keep paging with `next` until it is `null`.

## Anchors, cells, districts, regions

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/land/anchors?after=&limit=` | `{ anchors: [anchor + cursor], next }`, live res-12 occupants in cell order |
| GET | `/api/land/cell/{h3}` | One res-12 cell: the anchor object plus `protocol`, or `{ protocol, h3_cell, h3_res, district, region, status: "free" }` |
| GET | `/api/land/district/{h3}?after=&limit=` | `{ protocol, district, region, h3_res: 7, live_cells, founder, parcels, next, standing }`; `parcels` in priority order |
| GET | `/api/land/districts?after=&limit=` | `{ protocol, h3_res: 7, districts: [{ district, region, founder_parcel, anchor_id, final, priority, cursor }], next }` |
| GET | `/api/land/region/{h3}?after=&limit=` | `{ protocol, region, h3_res: 4, districts: [{ district, live_cells, founder, cursor }], next, standing }`; districts with live cells, in id order |

`{h3}` must be a canonical lowercase H3 cell (`isValidCell`). `cell` takes res 12 only. `district` and `region` take a cell at that resolution or any finer cell, which is converted with `cellToParent`.

`cooldown_remaining` is always `0` in `/anchors` and `/district` rows; read `/api/land/parcel/{block}` or `/api/land/cell/{h3}` for the live value.

`GET /api/land/cell/8c28308280f37ff` when free:

```json
{ "protocol": "Ð:LAND", "h3_cell": "8c28308280f37ff", "h3_res": 12,
  "district": "872830828ffffff", "region": "8428309ffffffff", "status": "free" }
```

`founder` in a district is `null` while the district has no live anchor and no final founder, otherwise `{ parcel, anchor_id, final, priority }`. It is the lowest-key live occupant until that key is final, then permanent ([INDEXING.md §5.5](INDEXING.md)).

Dogex does not store missed or losing anchor attempts, so `cell` has no `missed` field.

Limits: `/holder/{address}` fills `anchored` and `builds` for the first 500 titles the address holds, and at most 100 builds per parcel. Every other list is paged without a cap.

## Holders

`GET /api/land/holder/{address}`

```json
{
  "address": "D…",
  "titles": [0, 42],
  "anchored": [0],
  "builds": [{ "parcel": 0, "pack": "bbbb…i0" }]
}
```

`titles` are the parcels the address holds now. `anchored` is the subset with a live anchor.

## State root (identical-index check)

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/dmaps/state/root` | Root at the indexed tip |
| GET | `/api/dmaps/state/root/{height}` | Root after a height |
| GET | `/api/dmaps/state/delta/{height}` | The record changes applied at a height |
| GET | `/api/dmaps/checkpoint/latest` | Full `dmaps-checkpoint/2` snapshot at the indexed tip |
| GET | `/api/land/state/…`, `/api/land/checkpoint/latest` | Same bodies |

`GET /api/dmaps/state/root/100` (regtest vector):

```json
{
  "version": "dmaps-state/2",
  "height": 100,
  "root": "398d9c7df50b8f907288e14a0482e227c8a23840659c9675c7359efaae5bc38e",
  "last_change_height": 100
}
```

`GET /api/dmaps/state/delta/100`:

```json
{
  "version": "dmaps-state/2",
  "height": 100,
  "prev_root": "274aefa54afb19babd38f49c47ce619e21e179ce6c637ad18b0925aa017a6dd8",
  "root": "398d9c7df50b8f907288e14a0482e227c8a23840659c9675c7359efaae5bc38e",
  "entries": ["+T 0 aaaa…i0", "+T 1 dddd…i0", "+T 2 9999…i0"],
  "delta_text": "height=100\n+T 0 aaaa…i0\n…"
}
```

`root = SHA-256(prev_root + "\n" + delta_text)` for a block that changed state; a block that changed nothing keeps the root, has `entries: []` and `delta_text: null`. `last_change_height` is the last height at or below `height` that changed state (`null` = genesis root). Two indexers that agree on the root at a height hold identical records ([INDEXING.md §8](INDEXING.md)).

`GET /api/dmaps/checkpoint/latest`:

```json
{
  "version": "dmaps-checkpoint/2",
  "state_version": "dmaps-state/2",
  "height": 252,
  "root": "9600db165c892a7beb6d2a2ce32bf73d9c9f856caac83caec1e81bc8c2c41c31",
  "hash": "<sha-256 of checkpoint>",
  "checkpoint": "dmaps-checkpoint/2\nnetwork=regtest\nheight=252\n…\nroot=9600…\nT 0 aaaa…i0\n…"
}
```

The snapshot is built on demand from the records at the tip (Dogex no longer writes a checkpoint per block). `/api/dmaps/checkpoint/{height}` answers only for the tip height; for an older height compare `state/root/{height}`.

## Quick start

```sh
curl -s -H 'Accept: application/json' https://dogex.command.dog/api/land/status
curl -s -H 'Accept: application/json' 'https://dogex.command.dog/api/doginals/dogemaps/claims?offset=0&limit=50'
curl -s -H 'Accept: application/json' https://dogex.command.dog/api/land/parcel/0
curl -s -H 'Accept: application/json' https://dogex.command.dog/api/land/cell/8c28308280f37ff
curl -s -H 'Accept: application/json' https://dogex.command.dog/api/dmaps/state/root
```

Writes are inscriptions, not API calls. To anchor or build, the current title holder broadcasts a committed ÐLand reveal that spends the title UTXO (see [README.md](../README.md#minimal-dapp-path) and [protocols/dland/spec.md](../protocols/dland/spec.md)). Broadcast through any Dogecoin node; this API only reads the result.
