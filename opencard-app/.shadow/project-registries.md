# Project Registries

## Boundary

`.opencard/.ocproject` owns project information and the remote-resource policy.
`.opencard/.ocfonts` owns font families and font compositions. `.opencard/.ocicons` owns
ordered icon sets. `.opencard/.oclocale` owns project localization, and
`.opencard/.ocblocks` owns custom-block registrations. Sources inside these
registries are relative to `.opencard`; managed files live in `fonts`, `icons`,
and `blocks` beneath that directory.

## Runtime Truth

`useProjectStore` is the filesystem truth source. It exposes
`projectFontFamilies`, `projectFontCompositions`, the resolved `projectFonts`
catalog, and `projectIconSeries` separately from `projectProfile`. Font CSS
loading and icon catalog construction consume those dedicated refs only.

Opening or creating a project ensures all five documents and all three managed
asset directories exist. A directory without `.opencard` requires explicit
initialization; legacy root-level `.oc*` project files are rejected rather than
migrated. Invalid registry files clear only their own runtime domain and report a
domain-specific error. Asset file changes reload the affected registry resources
without reloading unrelated project data.

## Document Contract

`.ocfonts` uses
`{ families?: ProjectFontFamily[], compositions?: ProjectFontComposition[] }`.
Each family has one or more file-backed faces with weight, stretch, and style
descriptors. Each composition is an ordered, non-nesting list of family
references; a member may restrict itself to normalized Unicode ranges. Family
and composition Keys share one case-insensitive namespace.

Font sources are relative to `.opencard` and must remain beneath `fonts/`.
TTC/OTC imports are extracted into standalone TTF/OTF faces; collection indices
never enter the persisted model. Composition fallback uses both the configured
range and the face's actual glyph coverage. An omitted member range means the
remaining glyphs that the family can provide after earlier members.

`.ocicons` uses `{ iconSeries?: ProjectIconSeries[] }`.
Unknown and removed document-level fields are ignored on read. Known fields and nested
resource records remain validated. Serialization writes only the canonical
known fields and omits empty collections.

## Non-Reversible Constraint

Legacy `fonts` and `iconSeries` fields in a profile are ignored. There is no
automatic migration, compatibility bridge, fallback read, or dual-write path.
Saving a profile canonicalizes it without those legacy fields.

## Editor Protocol

The managed editor ids are `font-registry` and `icon-registry`. Icon duplicate-key
issues use the `icon-registry` navigation protocol, version 1, and carry stable
indices plus the conflicting key. Editors own business state and commands;
shared shell and repair components own only common document UI geometry.

The font registry editor presents families and compositions as independent tree
roots. Compositions may reference only families, and a referenced family is
protected from deletion. Common registration stays small; face descriptors and
member character ranges are exposed through explicit advanced controls.

Font import reads embedded family, face, weight, width, style, and variable-axis
metadata. Multi-file selections are grouped by embedded family name. Collection
member indices exist only in the pending import request and are discarded after
the chosen TTC/OTC members are extracted. A family editor may add, replace, and
remove several faces, but overlapping face descriptor ranges cannot be saved.

Removing an unreferenced family is a confirmation workflow. Orphaned managed
font files are selected for Recycle Bin cleanup by default, while sources still
used by another family are always retained. Byte-identical imports reuse the
existing managed file even when their incoming filename differs.

Custom-block packages preserve the same font semantics rather than flattening a
reference to one file. Their manifest font index contains discriminated family
and composition resources: families retain every face descriptor and
compositions retain ordered member ranges. Packaging copies the complete
dependency closure, remaps package-local Keys case-insensitively, and
content-deduplicates face bytes. Runtime composition loading intersects each
member with actual glyph coverage and removes characters already claimed by an
earlier member with the same face descriptors.

The font workbench treats diagnostics as part of preview truth. It surfaces
runtime loading failures and coverage-read failures for the selected entry, and
marks a composition member as fully shadowed only after readable face coverage
has contributed no characters beyond earlier members with matching descriptors.
Invalid range text remains a blocking inline error in the composition dialog.

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
