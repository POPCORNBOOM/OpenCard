# Project Registries

## Boundary

`.ocproject` owns project information and the remote-resource policy.
`.ocfonts` owns project fonts and font sets. `.ocicons` owns ordered icon sets.
`.oclocale` owns project localization. The four files are independent root-only structured documents.

## Runtime Truth

`useProjectStore` is the filesystem truth source. It exposes `projectFonts` and
`projectIconSeries` separately from `projectProfile`. Font CSS loading and icon
catalog construction consume those dedicated refs only.

Missing registry files mean an empty registry. Invalid registry files clear only
their own runtime domain and report a domain-specific error. Asset file changes
reload the affected registry resources without reloading unrelated project data.

## Document Contract

`.ocfonts` uses `{ fonts?: ProjectFont[], fontSets?: ProjectFontSet[] }`.
`.ocicons` uses `{ iconSeries?: ProjectIconSeries[] }`.
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

The icon registry editor uses a controlled two-column workbench and must not
mirror the registry array into a second draft. The left column owns the editor
title and one expanded icon-set section; its body pairs the icon tree with a
property editor whose intrinsic height determines the section height. Only the
tree scrolls within that height. The right column owns the persistent atlas
viewport above a large selected-icon preview.

The selected canvas reuses the project catalog immediately, then refreshes only
its current series when editor-local asset state changes. Crop interaction stays
local until pointer release and emits one immutable series replacement per drag.
The icon tree filters by display name or icon key while retaining original array
indexes for every command, and opts into `OcTree` fixed-row virtualization.
Registration and issue navigation select through the workbench API.
