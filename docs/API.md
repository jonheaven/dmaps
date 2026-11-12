# Dogex HTTP API for ÐMaps and ÐLand

Base URL: the Dogex / command.dog indexer the dApp is configured to use (for example `https://explorer.command.dog` or a self-hosted `dogexd`). All routes below are **read-only JSON**, `application/json; charset=utf-8`. Heights are decimal integers. Inscription ids are `<64 lowercase hex>i<vout>`. H3 cells are lowercase hex, no `0x`.

A machine-readable contract is in [openapi.yaml](openapi.yaml). Until `MAPS_ACTIVATION_HEIGHT` / `LAND_ACTIVATION_HEIGHT` are announced in [INDEXING.md](INDEXING.md), mainnet responses are empty (activation disabled). On regtest they are live from height 0.

## Capabilities

`GET /api/doginals/capabilities`

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
    "neighbors_indexed": false
  },
  "activation": {
    "maps_activation_height": null,
    "land_activation_height": null,
    "commit_window_blocks": 30
  }
}
```

## Status

`GET /api/land/status` → `{ "protocol": "Ð:LAND", "tip": 0, "maps_activation_height": null, "land_activation_height": null, "window": 30, "reanchor_cooldown": 144, "h3": "4.2.1", "h3_res": 12, "district_res": 7, "region_res": 4, "neighbors_indexed": false }`

## Claims (ÐMaps titles)

| Method | Path | Meaning |
| --- | --- | --- |
| GET | `/api/doginals/dogemaps/claims?offset=&limit=` | Page of canonical v1 claims (`block_number`, `inscription_id`, derived `lat`, `lon`, `h3_cell` when computed) |
| GET | `/api/doginals/dogemaps/claims/{block}` | Alias of the next row |
| GET | `/api/doginals/r/dogemap/block/{block}` | Title for one height, or 404 |
| GET | `/api/doginals/r/dogemap/list` | Same as `/claims` |
| GET | `/api/doginals/r/dogemap/count` | `{ "count": N }` |
| GET | `/api/doginals/address/{address}/dogemaps` | Titles currently held by `address` |

Example, `GET /api/doginals/r/dogemap/block/0`:

```json
{
  "block_number": 0,
  "inscription_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaai0",
  "claim_height": 100,
  "lat": -68.90142302960157,
  "lon": -91.75832798704505,
  "h3_cell": "89e98d184b7ffff",
  "h3_res": 9
}
```

Legacy `{n}.dogemap` rows MUST NOT appear as canonical titles in these objects. If an indexer also stores OG labels, it MUST use a separate field such as `og_inscription_id`.

## Parcels (title + LAND state)

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
      "last_height": 102
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
    "cooldown_remaining": 0
  },
  "is_founder": true,
  "standing": { "version": "land-standing/1", "score": 31, "neighbors_indexed": false }
}
```

404 if there is no canonical title for that height.

## Packs, builds, anchors

| Method | Path | Meaning |
| --- | --- | --- |
| GET | `/api/land/packs?after=&limit=` | Listed packs (`id`, `name`, `version`, `height`). `limit` default 100, max 500 |
| GET | `/api/land/packs/{id}` | One pack, including `schema` / `schema_uri` |
| GET | `/api/land/builds?parcel=&pack=` | Live builds, filterable |
| GET | `/api/land/anchors?after=&limit=` | Live cell occupants |

## Cells, districts, regions

| Method | Path | Meaning |
| --- | --- | --- |
| GET | `/api/land/cell/{h3}` | Occupant parcel, priority, `status` (`pending`\|`final`\|`free`), missed claims if stored |
| GET | `/api/land/district/{h3}` | Founder, live parcel list, standing (advisory) |
| GET | `/api/land/region/{h3}` | Live districts, standing (advisory) |

`GET /api/land/cell/8c28308280f37ff` when free:

```json
{ "protocol": "Ð:LAND", "h3_cell": "8c28308280f37ff", "h3_res": 12, "status": "free" }
```

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

Addresses are Dogecoin base58. Also: `GET /api/doginals/address/{address}/dogemaps` for titles only.

## Checkpoints (identical-index check)

`GET /api/dmaps/checkpoint/{height}`  
`GET /api/land/checkpoint/{height}` (same body)

```json
{
  "version": "dmaps-checkpoint/1",
  "height": 104,
  "hash": "ad2d30ec3360402444b94bd63b7b498120d47899152f4e2ea19558d29bc8b5bb",
  "checkpoint": "dmaps-checkpoint/1\nnetwork=regtest\n…"
}
```

`hash` MUST be SHA-256 of the exact `checkpoint` string (see [INDEXING.md §8](INDEXING.md)). 404 if that height is not yet indexed.

## Errors

| Status | When |
| --- | --- |
| 400 | Bad inscription id, bad H3 string, bad address |
| 404 | Unknown parcel / pack / height, or indexer off |
| 503 | Indexer not loaded (`doginals` disabled) |

Query `offset` / `limit` / `after` are optional. Unknown query params are ignored.
