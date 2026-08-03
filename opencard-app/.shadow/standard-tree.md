# Standard Tree Performance

`OcTree` keeps the complete key-only data contract as its truth source. Consumers
with high-cardinality, fixed-height rows may opt into `virtualized`; ordinary trees
remain non-virtualized by default. Virtualization windows only DOM rows and must
preserve absolute visible-entry indexes for selection, keyboard focus, rename,
drag/drop, `scrollToSelection`, and `aria-posinset` / `aria-setsize` semantics.

Tree rows use the shared `--oc-size-md` height contract. Do not introduce variable
row heights into virtual mode without replacing the offset model. `OcActionButton`
must not mount Floating UI or register document-level outside-pointer listeners
until a menu is actually opened and pinned.
