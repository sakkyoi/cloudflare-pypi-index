# Setup

## Cloudflare resources

Create the bucket:

```bash
npx wrangler r2 bucket create python-index
```

Create the Queue:

```bash
npx wrangler queues create python-index-events
```

Deploy the Worker scaffold:

```bash
cp wrangler.example.toml wrangler.toml
npm --prefix cloudflare run deploy
```

Edit `wrangler.toml` before deployment:

```toml
name = "your-worker-name"

[[r2_buckets]]
binding = "INDEX_BUCKET"
bucket_name = "your-r2-bucket-name"

[[queues.consumers]]
queue = "your-r2-event-queue-name"
```

`npm run deploy` also ensures R2 event notifications exist. To create them
separately:

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

## R2 S3 credentials

Create an R2 API token with Object Read & Write permission scoped to the bucket.
Use the generated Access Key ID and Secret Access Key with the CLI or action.

The endpoint format is:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Use region `auto`.
