# Setup

## Cloudflare resources

Deploy the Worker scaffold:

```bash
node cloudflare/scripts/render-wrangler-config.mjs \
  --worker-name your-worker-name \
  --bucket your-r2-bucket-name \
  --queue your-r2-event-queue-name

npm --prefix cloudflare run deploy
```

The render command writes `cloudflare/wrangler.toml`. Keep these binding names
unchanged if you edit that file manually:

```toml
[[r2_buckets]]
binding = "INDEX_BUCKET"

[[durable_objects.bindings]]
name = "PROJECT_INDEX"
class_name = "ProjectIndexDO"
```

`npm run deploy` ensures the configured R2 bucket and Queue exist, deploys the
Worker, and ensures R2 event notifications exist.

To create notifications separately:

```bash
npm --prefix cloudflare run notifications:create
```

List configured notifications:

```bash
npm --prefix cloudflare run notifications:list
```

Delete configured notifications:

```bash
npm --prefix cloudflare run notifications:delete
```

Set an admin token for manual rebuilds:

```bash
cd cloudflare
npx wrangler secret put ADMIN_TOKEN
```

Use the admin token to manage Basic Auth accounts. See `docs/auth.md`.
The index is private by default. Set `[vars].PUBLIC_INDEX = "true"` in
`cloudflare/wrangler.toml` only if anonymous reads should be allowed.

## R2 S3 credentials

Create an R2 API token with Object Read & Write permission scoped to the bucket.
Use the generated Access Key ID and Secret Access Key with the CLI or action.

The endpoint format is:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Use region `auto`.
