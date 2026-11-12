> Informative in this repo: how Era-2 `dog` markers relate to classic `ord` inscriptions. ÐMaps and ÐLand payloads are JSON; either envelope may carry them.

# Dog Marker Envelope Specification (GDR / eternal.dog lab)

**Status:** Lab — **Good Dog Registry** / [eternal.dog](https://eternal.dog) only.  
**Not** the Doginals inscription standard. Community Doginals, ÐMP listings, and **minted dog photos / media** use regular push-only **`ord`**.

This document defines an optional **`dog`** envelope for **GDR registry JSON** (`p:"GDR"` register / addendum / …) when eternal.dog wants a distinct carrier from image Doginals. Indexers that do not implement `dog` MUST still accept GDR JSON on `ord`.

## Overview

> **Dogecoin carrier.** Dogecoin has no SegWit or Taproot witness, and Core requires a push-only scriptSig, so the `OP_FALSE OP_IF … OP_ENDIF` form below cannot appear in a Dogecoin transaction. It describes the envelope's logical layout (and witness chains). On Dogecoin the only carrier is the push-only era-1 form in Vector C: `PUSH("dog") PUSH(version) PUSH(<cbor>)…` in `vin[0].scriptSig`, followed by `<sig> <redeem>` of a P2SH reveal (use the committed redeem, [committed-envelope.md](committed-envelope.md)).

The dog marker uses the pattern `OP_FALSE OP_IF "dog"` followed by a versioned envelope structure. Intended payload is GDR registry data (compact JSON/CBOR), not image bytes.

- Versioned envelopes for GDR registry evolution
- CBOR-preferred metadata for compact registry bodies
- Optional signature / commitment hooks for pack identity
- **Out of scope:** photo mints, marketplace ops, general Doginals collections — those stay `ord`

## Envelope Structure

### Basic Format

```
OP_FALSE
OP_IF
  "dog"
  <version_byte>
  <envelope_data>
OP_ENDIF
```

Where:
- `version_byte`: Single byte indicating envelope version (0x01 for v1)
- `envelope_data`: Version-specific data structure

### Version 1 Envelope (0x01)

For version 1, the envelope uses a CBOR-encoded structure:

```cbor
{
  "p": "protocol_name",  // Protocol identifier
  "v": "1.0",           // Protocol version
  "op": "operation",    // Operation type
  // ... protocol-specific fields ...
  "meta": {             // Optional metadata
    "content_type": "application/json",
    "encoding": "utf-8",
    "size": 1024
  },
  "sig": "hex_signature",  // Optional quantum-safe signature
  "vault": "commitment_hash"  // Optional private vault commitment
}
```

### Script Encoding

The CBOR data is encoded as script pushes:

```
OP_FALSE
OP_IF
  "dog"
  0x01  // Version byte
  <push_cbor_data>
OP_ENDIF
```

Where `<push_cbor_data>` is the CBOR bytes pushed using appropriate OP_PUSH operations.

## Version Evolution

New versions can introduce:
- New CBOR fields
- Different serialization formats
- Enhanced signature schemes
- Additional commitment types

Indexers MUST support all defined versions and gracefully handle unknown versions by falling back to basic inscription detection.

## CBOR vs JSON

- **CBOR preferred**: More compact, binary-efficient
- **JSON fallback**: For simple protocols or debugging
- **Content negotiation**: Clients can request preferred format

## Quantum-Safe Signatures

The `sig` field supports post-quantum signature schemes:

- Dilithium (recommended)
- Falcon
- SPHINCS+

Signatures are over the canonical CBOR data excluding the `sig` field.

## Private Vault Commitments

The `vault` field allows commitments to private data stored off-chain:

- Hash of encrypted payload
- Merkle root of data structure
- Zero-knowledge proof commitments

This enables privacy-preserving inscriptions while maintaining on-chain verifiability.

## Compatibility

Dog marker inscriptions are fully compatible with:

- Dogenals numbering (continuous sequence)
- ÐMS metadata
- ÐMP marketplace
- All protocol participation

They produce the same unified Dogenals state as ord inscriptions.

## Implementation Notes

### Parser Requirements

Indexers MUST:

1. Detect `OP_FALSE OP_IF "dog"` pattern
2. Extract version byte
3. Parse envelope according to version
4. Convert to unified Dogenals format
5. Apply protocol-specific validation

### Fallback Handling

For unknown versions:
- Extract basic inscription data
- Mark as "unsupported version" but still index
- Allow protocol participation where possible

### Security Considerations

- Validate CBOR structure to prevent exploits
- Verify signatures when present
- Handle malformed envelopes gracefully
- Prevent resource exhaustion from large payloads

## Future Extensions

Version 2+ may include:
- Compressed CBOR
- Batch inscription support
- Multi-party signatures
- Temporal commitments

## Examples

### Simple JSON Protocol

```cbor
{
  "p": "example",
  "v": "1.0",
  "op": "create",
  "data": "Hello Dogecoin!"
}
```

### With Metadata and Signature

```cbor
{
  "p": "nft",
  "v": "1.0",
  "op": "mint",
  "name": "Rare Doge",
  "meta": {
    "content_type": "image/png",
    "size": 2048
  },
  "sig": "dilithium_signature_hex"
}
```

This envelope provides a solid foundation for Dogenals Era 2 while maintaining the ecosystem's core principles of openness, verifiability, and future-proofing.

## Conformance test vectors (byte-level)

These vectors are intended for parser conformance tests and indexer cross-checking.

### Vector A: witness-layout dog v1, minimal payload (not a Dogecoin carrier)

- CBOR diagnostic: `{"data":"hi"}`
- CBOR hex: `a16464617461626869`

Tapscript assembly:

```text
OP_FALSE OP_IF "dog" OP_1 <cbor> OP_ENDIF
```

Expected script hex:

```text
00 63 03 64 6f 67 51 09 a1 64 64 61 74 61 62 68 69 68
```

Expected indexer behavior:

1. Detect dog marker envelope.
2. Parse version as `1`.
3. Decode CBOR map.
4. Materialize body bytes as UTF-8 `hi`.
5. If no `content_type` is present, default to `application/octet-stream`.

### Vector B: witness-layout dog unknown version (not a Dogecoin carrier)

Tapscript assembly:

```text
OP_FALSE OP_IF "dog" OP_9 <opaque bytes> OP_ENDIF
```

Expected indexer behavior:

1. Detect dog marker envelope.
2. Treat version `9` as unsupported.
3. Preserve opaque bytes.
4. Index as unsupported (do not drop silently).

### Vector C: era1 script_sig dog marker (the Dogecoin carrier)

Data pushes:

```text
PUSH("dog") PUSH(0x01) PUSH(<cbor bytes>)
```

Expected indexer behavior:

1. Parse as dog v1 envelope path when no `ord` marker exists.
2. Apply same CBOR decoding semantics as witness dog v1.
3. Produce the same unified inscription representation as witness path.