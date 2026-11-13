# Dogex HTTP API for ÐMaps and ÐLand

This is the read API a dApp uses to show ÐMaps parcels and ÐLand packs, builds, and anchors. It describes what Dogex serves today, route for route and field for field.

**The chain is the authority, not this API.** Every title and every ÐLand op is a Dogecoin inscription. Any indexer that follows [INDEXING.md](INDEXING.md) reaches the same state from the same blocks, and two indexers can compare a `dmaps-checkpoint/1` hash at any height. Dogex is one such reader. Treat its answers as a convenience, and compare checkpoint hashes (or a second indexer) when it matters.

## Base URL

| Host | Use |
| --- | --- |
| `https://dogex.command.dog` | Public Dogex index (mainnet) |
| `https://dogex.command.dog/docs/dmaps` | One-page brief with live links |
| `https://dogex.command.dog/#dland` | Console: parcel / cell / pack / holder lookup, checkpoint, packs, builds, anchors |
| `http://127.0.0.1:8080` | A self-hosted `dogexd` (default listen) |

No API key. CORS is open. Every route is `GET`, read-only, and returns `application/json`. Send `Accept: application/json`.

Conventions: heights and parcel numbers are decimal integers. Inscription ids are `<64 lowercase hex>i<n>`. H3 indexes are lowercase hex with no `0x` and no leading zeros. Addresses are Dogecoin base58.

## Activation: read this before you trust an empty answer

`maps_activation_height` and `land_activation_height` are `null` until a mainnet height is announced in [INDEXING.md](INDEXING.md). While a height is `null`, Dogex indexes nothing for that protocol on that network: title lists are empty, `parcel` and `checkpoint` lookups return 404, and pack/build/anchor lists are empty. That is expected, not an outage. On regtest both are `0` (live from genesis).

Always read `GET /api/land/status` first and check `maps_live` / `land_live` before you tell a user that a parcel or cell is unclaimed. An operator can set a height early with `DOGEX_DOGEMAP_ACTIVATION_HEIGHT` / `DOGEX_LAND_ACTIVATION_HEIGHT`; `/api/land/status` always reports the value the process is using.

## Errors

An error is an HTTP status with a short **plain-text** body (not JSON).

| Status | When |
| --- | --- |
| 400 | A path value does not parse: height, inscription id, H3 string, or address |
| 404 | No title for that height, unknown pack, no checkpoint at that height, or height above the indexed tip |
| 503 | The inscription indexer is not loaded on this host (body `doginals disabled (pure node mode)`) |

Unknown query parameters are ignored.

## Paging

| Routes | Style |
| --- | --- |
| `/api/doginals/dogemaps/claims` | `offset` (count of titles) and `limit` (default 50, max 500). `page_size` is accepted as a synonym for `limit` |
| `/api/land/packs`, `/builds`, `/anchors`, `/districts` | Cursor. Each row has a `cursor`; pass the last row's value as `after=` for the next page. `after` is exclusive. `limit` default 100, max 500 |

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
  "checkpoint_version": "dmaps-checkpoint/1",
  "routes": ["GET /api/land/status", "GET /api/land/parcel/{block}", "…"],
  "window": 30,
  "reanchor_cooldown": 144,
  "h3": "4.2.1",
  "h3_res": 12,
  "district_res": 7,
  "region_res": 4,
  "neighbors_indexed": false
}
```

`network` is `dogecoin`, `testnet`, or `regtest`. `maps_live` / `land_live` are `true` once the height is set and `tip` has reached it. `maps_flag` / `land_flag` are `false` when the operator turned the protocol off for this process.

## Capabilities

`GET /api/doginals/capabilities` is a feature probe for the whole indexer. Its `land` object and `activation` block always describe **mainnet** defaults; use `/api/land/status` for the values the process is actually running with.

```json
{
  "schema": "dogex.doginals.capabilities/1",
  "committed_envelope": { "verify": true },
  "dns_commit_first": { "supported": true },
  "land": {
    "supported": true,
    "marker": "Ð:LAND",
    "h3_res": 12,
    "district_res": 7,
    "region_res": 4,
    "holder_spend": true,
    "commit_first": true,
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

Only canonical v1 titles (`p: "Ð:MAPS"`, `op: "claim"`, first valid claim per height) appear. Legacy `{n}.dogemap` text never takes a title slot.

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
      "body": "earth"
    }
  ]
}
```

`entries` is `[]` when the height has no title; this route returns 200 either way. `/api/land/parcel/{block}` is the route that answers 404 for an unclaimed height.

`lat` / `lon` are the [ÐMaps §7](../protocols/dogemaps/spec.md) seed for that height at the default resolution 9. Dogex does not return the H3 cell. Compute it with h3-js 4.2.1: `latLngToCell(lat, lon, 9)`. Height 0 gives `89e98d184b7ffff`; see [h3.md](h3.md) and `reference/dmaps-geo.mjs`.

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
  "holder": "D…",
  "builds": [
    {
      "pack": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbi0",
      "pack_name": "street-scene",
      "content": { "model": "ipfs://z" },
      "sealed": false,
      "applied": 1,
      "last_build": "1111…i0",
      "last_height": 102,
      "parcel": 0,
      "cursor": "0000000000|bbbb…i0"
    }
  ],
  "anchor": {
    "h3_cell": "8c28308280f37ff",
    "h3_res": 12,
    "district": "87283082bffffff",
    "region": "842830fffffffff",
    "status": "pending",
    "priority": { "height": 103, "tx_index": 0, "vout": 0 },
    "from_commit": true,
    "anchor_id": "cccc…i0",
    "parcel": 0,
    "cooldown_remaining": 0
  },
  "is_founder": true,
  "standing": { "version": "land-standing/1", "neighbors_indexed": false }
}
```

- `holder` is the address holding the title inscription now (not the address that claimed it). `null` if the indexer cannot place it.
- `anchor` is `null` when the parcel has no live anchor. `status` is `pending` until the anchor is more than `window` (30) blocks deep, then `final`. `cooldown_remaining` is blocks until the holder may re-anchor (144-block cooldown).
- `is_founder` is `true` when this parcel founded its res-7 district.
- `standing` is advisory and not in the checkpoint. Dogex does not compute a `score` or neighbor counts (`neighbors_indexed: false`).
- 404 when the height has no canonical title.

## Packs

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/land/packs?after=&limit=` | `{ packs: [{ id, name, version, height, cursor }] }` in id order |
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

`GET /api/land/builds?parcel=&pack=&after=&limit=` → `{ builds: [build] }`. Each build has the same fields as in `parcel.builds`. Filter by `parcel`, by `pack`, or both. `limit` bounds the scan before the `pack` filter, so a filtered page can be shorter than `limit`; keep paging with the last `cursor` until a page comes back empty.

## Anchors, cells, districts, regions

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/land/anchors?after=&limit=` | `{ anchors: [anchor + cursor] }`, live res-12 occupants in cell order |
| GET | `/api/land/cell/{h3}` | One res-12 cell: the anchor object plus `protocol`, or `{ protocol, h3_cell, h3_res, status: "free" }` |
| GET | `/api/land/district/{h3}` | `{ protocol, district, h3_res: 7, founder, parcels, standing }` |
| GET | `/api/land/districts?after=&limit=` | `{ protocol, h3_res: 7, districts: [{ district, region, founder_parcel, anchor_id, final, priority, cursor }] }` |
| GET | `/api/land/region/{h3}` | `{ protocol, region, h3_res: 4, districts: [{ district, founder_parcel, final }], standing }` |

`cooldown_remaining` is always `0` in `/anchors` and `/district` rows; read `/api/land/parcel/{block}` or `/api/land/cell/{h3}` for the live value.

`GET /api/land/cell/8c28308280f37ff` when free:

```json
{ "protocol": "Ð:LAND", "h3_cell": "8c28308280f37ff", "h3_res": 12, "status": "free" }
```

`founder` in a district is `null` until a parcel anchors there, otherwise `{ parcel, anchor_id, final, priority }`.

Dogex does not store missed or losing anchor attempts, so `cell` has no `missed` field.

Current limits: `/district/{h3}` scans the first 500 live anchors and `/region/{h3}` the first 500 districts; `parcel.builds` and `holder.builds` read at most 500 builds per parcel.

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

## Checkpoints (identical-index check)

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/dmaps/checkpoint/latest` | Checkpoint at the indexed tip |
| GET | `/api/dmaps/checkpoint/{height}` | Checkpoint at a height |
| GET | `/api/land/checkpoint/latest`, `/api/land/checkpoint/{height}` | Same bodies |

```json
{
  "version": "dmaps-checkpoint/1",
  "height": 104,
  "hash": "ad2d30ec3360402444b94bd63b7b498120d47899152f4e2ea19558d29bc8b5bb",
  "checkpoint": "dmaps-checkpoint/1\nnetwork=regtest\n…"
}
```

`hash` is the SHA-256 of the exact `checkpoint` string ([INDEXING.md §8](INDEXING.md)). Dogex writes a checkpoint for every block at or past ÐLand activation. 404 above the indexed tip, before activation, or when none was written.

## Quick start

```sh
curl -s -H 'Accept: application/json' https://dogex.command.dog/api/land/status
curl -s -H 'Accept: application/json' 'https://dogex.command.dog/api/doginals/dogemaps/claims?offset=0&limit=50'
curl -s -H 'Accept: application/json' https://dogex.command.dog/api/land/parcel/0
curl -s -H 'Accept: application/json' https://dogex.command.dog/api/land/cell/8c28308280f37ff
curl -s -H 'Accept: application/json' https://dogex.command.dog/api/dmaps/checkpoint/latest
```

Writes are inscriptions, not API calls. To anchor or build, the current title holder broadcasts a committed ÐLand reveal that spends the title UTXO (see [README.md](../README.md#minimal-dapp-path) and [protocols/dland/spec.md](../protocols/dland/spec.md)). Broadcast through any Dogecoin node; this API only reads the result.
