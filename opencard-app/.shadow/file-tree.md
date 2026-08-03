# Project File Tree

`fileTypes.ts` owns root special-file presentation. A definition with
`projectTreePriority` receives its translated `labelKey` and fixed root ordering
in the project tree. `useShellFileTree` receives translation as an explicit
dependency and must not hardcode registry filenames or localized labels.

Only root files resolve this presentation. Their real paths remain node keys and
all file commands continue to target those keys. Same-named files in nested
directories keep their literal filenames. Ordinary roots retain index order after
the prioritized project files.
