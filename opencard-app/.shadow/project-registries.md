# Project Registries

## Boundary

`.opencardprojectprofile` owns project information and the remote-resource policy.
`.fontreg` owns the project font registry. `.iconreg` owns ordered icon series.
The three files are independent root-only structured documents.

## Runtime Truth

`useProjectStore` is the filesystem truth source. It exposes `projectFonts` and
`projectIconSeries` separately from `projectProfile`. Font CSS loading and icon
catalog construction consume those dedicated refs only.

Missing registry files mean an empty registry. Invalid registry files clear only
their own runtime domain and report a domain-specific error. Asset file changes
reload the affected registry resources without reloading unrelated project data.

## Document Contract

`.fontreg` uses `{ fonts?: Record<key, { name, source }> }`.
`.iconreg` uses `{ iconSeries?: ProjectIconSeries[] }`.
Unknown document-level fields are ignored on read. Known fields and nested
resource records remain validated. Serialization writes only the canonical
known fields and omits empty collections.

## Non-Reversible Constraint

Legacy `fonts` and `iconSeries` fields in a profile are ignored. There is no
automatic migration, compatibility bridge, fallback read, or dual-write path.
Saving a profile canonicalizes it without those legacy fields.

## Editor Protocol

The root editor ids are `font-registry` and `icon-registry`. Icon duplicate-key
issues use the `icon-registry` navigation protocol, version 1, and carry stable
indices plus the conflicting key. Editors own business state and commands;
shared shell and repair components own only common document UI geometry.
