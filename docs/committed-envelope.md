> **In this repository:** the committed (content-binding) P2SH lock is **normative** for every ÐLand `build` and `anchor`, and optional for ÐMaps claims (a claim is any inscription; first wins) and ÐLand packs. The text below is the Dogenals committed-envelope specification. Links to private implementation paths are informative; the lock itself is fully specified here.

# Committed envelope — a P2SH lock that fixes the reveal bytes

**Status:** Normative for ÐNS commit-first priority ([DNS spec §5.7](https://github.com/jonheaven/dns)), and for every ÐLand `build` and `anchor` in this repository. The same lock is used by Ð:MOD and Ð:BOX (specified in the Dogenals protocol set, not vendored here). Recommended for every new Doginals mint.
**Reference:** any indexer that implements the redeem below. This document is the normative lock.

## 1. The problem with the classic lock

The doginals.js reveal spends a P2SH output whose redeem script is

```text
<pubkey33> OP_CHECKSIGVERIFY OP_DROP×n OP_TRUE
```

`OP_DROP` throws every data push away. The redeem binds the reveal **key**, not the **content**. Legacy (pre-SegWit) signatures never cover any scriptSig, so the one signature in the reveal does not cover the envelope pushes either. Two consequences:

1. Anyone who relays or mines the reveal can replace the envelope pushes with different bytes (same push count), keep the signature and redeem, and the transaction is still valid. A config can be rewritten in flight, for example a pay-to `address` record.
2. The commit says nothing about what will be revealed, so commit order cannot be used to settle a race: whoever reveals a copied name first wins.

Dogecoin has no SegWit and no Taproot (`IsWitnessEnabled` is false, scriptSig must be push-only), so the Atomicals/ord tapscript envelope cannot be used. The fix has to live in the P2SH redeem.

## 2. The committed lock

Replace each `OP_DROP` with an equality check against a value fixed in the redeem:

```text
<pubkey33> OP_CHECKSIGVERIFY
for each data push, last pushed first:
    <literal>   OP_EQUALVERIFY                 if the push is 0..20 bytes
    OP_HASH160 <HASH160(push)> OP_EQUALVERIFY  if the push is longer
OP_TRUE
```

- `<literal>` uses minimal encoding: `OP_0` for empty, `OP_1`..`OP_16` for a single byte 1..16, `OP_1NEGATE` for `0x81`, otherwise a direct push. This matches what a minimal scriptSig push leaves on the stack.
- The reveal scriptSig is unchanged: `<ord> <parts> <mime> (<countdown> <chunk>)+ <sig> <redeem>`. Every Doginals parser that strips `<sig> <redeem>` (redeem ≥ 34 bytes containing `OP_CHECKSIGVERIFY`) reads it exactly as before. Old inscriptions are untouched.
- The commit pays `OP_HASH160 <HASH160(redeem)> OP_EQUAL`, so the commit transaction fixes the exact reveal bytes. Consensus refuses any other reveal. Script execution leaves exactly one true item (clean stack).

### Size limits

| Limit | Value | Source |
| --- | --- | --- |
| Redeem script | ≤ 520 bytes (one push) | `MAX_SCRIPT_ELEMENT_SIZE` |
| Standard scriptSig | ≤ 1650 bytes | `policy.cpp` `IsStandardTx` |
| Cost per data push | 2–22 bytes literal, 23 bytes hashed | — |

A committed partial holds less payload than a classic one (the redeem grows by ~25 bytes per 240-byte chunk). Builders MUST size each partial so the whole scriptSig stays ≤ 1650 bytes; the reference builders shrink the 1500-byte doginals.js partial target until it does (about 1270 payload bytes per reveal).

## 3. Indexer check ("bound")

An inscription is **bound** when its whole body is in one reveal transaction and `vin[0].scriptSig` is push-only, ends `<sig> <redeem>`, and `redeem` parses as §2 with one check per data push before `<sig>`, in reverse order, each matching. Indexers only check the redeem's **shape**: the block was valid, so the script already ran.

Multi-transaction bodies are not bound in v1 of this spec (each partial could be bound, but priority rules only use single-transaction reveals).

## 4. Wallet guidance

- Use a fresh one-time reveal key per inscription (doginals.lol and Dojak already do). Short bodies are pushed as literals, so a reused key would let an observer test guesses against the P2SH hash; a one-time key makes the hash unguessable without the key.
- For anything ranked by commit position (names, box claims), **wait for one confirmation of the commit before broadcasting the reveal.** Until the reveal is public nobody can learn the content, and once the commit is in a block nobody can get an earlier commit for a copy.
- Bitwork (optional; specified with ÐNS, not required for ÐLand) is ground by changing an input `nSequence` of the commit (`bitworkc`) or the reveal (`bitworkr`) and re-signing, never the redeem: the redeem is fixed by the content.

## 5. Vectors and interpreter check

The lock in §2–§3 is fully specified in this document (redeem shape, size limits, and the indexer “bound” check). Worked redeem-hex vectors and an interpreter harness (classic vs committed reveals) live with the Dogenals committed-envelope package; they are **not vendored in this repository** and are not required to implement or verify the lock. Dogex flags a reveal `bound` when it matches §3.
