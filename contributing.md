# Contributing

This is a specification repository. Prefer a discussion or an issue before a breaking change.

- Keep ÐMaps title rules stable. Put construction, packs, and chosen pins in ÐLand.
- Do not add features to a marketing doc that are missing from the normative spec.
- New indexer-visible behavior needs a deterministic rule in `docs/INDEXING.md` and a case in `reference/make-vectors.mjs`. Run `npm run vectors` to regenerate the vector files, then `npm test` (it fails if the files on disk differ from the generator).
- Pin H3 4.2.1 unless you can prove identical results and bump the genesis-root `h3=` line in a dated revision.
- Do not commit secrets, `.env`, or indexer implementation from private repositories.

License: MIT. By contributing you agree to that license.
