# Desktop E2E

The desktop suite drives a packaged OpenCard binary through Tauri WebDriver on Windows.

```powershell
cargo install tauri-driver --locked
npm run tauri build -- --no-bundle
npm run test:e2e
```

Set `OPENCARD_E2E_BINARY` to exercise an installed NSIS or MSI executable instead of
`src-tauri/target/release/OpenCard.exe`. The suite creates an isolated project, preserves
the current OpenCard settings file, and removes its project and version history afterward.
