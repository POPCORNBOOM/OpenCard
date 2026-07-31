# OpenCard feedback relay

This Cloudflare Worker accepts bounded feedback from the OpenCard desktop app and creates an issue in a private GitHub repository. It returns an opaque receipt token that the same device can later use to read a minimal status and one official response. The desktop app never receives a GitHub credential or private issue location.

## One-time account setup

1. Create a private GitHub repository named `OpenCard-reports`.
2. Create a GitHub App with webhooks disabled. Grant repository `Issues: Read and write`; GitHub adds `Metadata: Read` automatically.
3. Install the App only on `OpenCard-reports`, then record the App ID and installation ID and generate a private key.
4. In Cloudflare, choose an unused positive integer for the rate-limit `namespace_id` in `wrangler.jsonc` if `61001` is already used by another Worker in the account.
5. Create the `opencard-feedback-receipts` D1 database, set its ID in `wrangler.jsonc`, and apply the checked-in migrations.

The Worker accepts the production Tauri origins and `http://localhost:1420` for local development. Remove the development origin from `ALLOWED_ORIGINS` if remote development submissions are not needed.

## Deploy

From this directory:

```powershell
npm install
npx wrangler login
npx wrangler secret put GITHUB_APP_ID
npx wrangler secret put GITHUB_INSTALLATION_ID
npx wrangler secret put GITHUB_PRIVATE_KEY
npx wrangler d1 migrations apply opencard-feedback-receipts --remote
npm run deploy
```

Paste the full generated `.pem` file when Wrangler asks for `GITHUB_PRIVATE_KEY`. Both GitHub's PKCS#1 key format and PKCS#8 are supported. Do not commit the key or put it in an OpenCard environment file.

After deployment, configure the desktop build with the full Worker route:

```text
VITE_OPENCARD_FEEDBACK_ENDPOINT=https://opencard-feedback.opencardfeedbackworker.workers.dev/feedback
```

This value is a public endpoint, not a secret. It can be stored in the release build environment. Until it is set, OpenCard shows the feedback form as unavailable and never pretends a report was sent.

## Local verification

```powershell
npm test
npm run check
```

Submissions and receipt queries share a limit of five Worker requests per minute per edge-observed IP address. One batch query can refresh up to twenty non-closed receipts. The Worker validates payloads before contacting GitHub, rejects diagnostics on suggestions, and never logs report contents or receipt tokens.

An open Issue without a trusted comment appears as received. The newest comment written by a repository owner, member, collaborator, or the configured GitHub App becomes the user-visible answer. Closing the Issue makes it closed. No status labels or comment marker are required.
