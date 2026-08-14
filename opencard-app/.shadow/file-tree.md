# Project File Tree

`.opencard` is an application-owned boundary and must never appear in the
ordinary project file tree. `useShellFileTree` filters the directory and every
descendant even when the filesystem index contains them individually.

The five structured documents are projected as fixed, localized entries in a
separate project-management tree. Their absolute paths remain node keys so they
open through normal editor sessions, but they never receive ordinary rename,
move, create, or trash actions. Same-named files outside `.opencard` remain
ordinary user files.
