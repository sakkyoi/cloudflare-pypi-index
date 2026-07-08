# Cloudflare PyPI Index

Reusable tooling for publishing Python distributions and serving a product-ready
Python Simple Repository API from Cloudflare Workers and R2.

The source of truth is the package object in R2:

- packages are uploaded to `packages/<normalized-project>/<filename>`
- each object carries custom metadata such as `project`, `filename`, and `sha256`
- Cloudflare rebuilds derived `_index/simple/...` files from R2 metadata only
- Workers never download package bodies while rebuilding indexes

## Components

- `cloudflare-pypi`: local and CI-friendly Python CLI.
- `actions/publish`: GitHub composite action wrapper around the CLI.
- `cloudflare/`: Worker, Queue consumer, and Durable Object scaffold.

## Local quick start

```bash
uv run python -m build
uv run cloudflare-pypi check-dist --dist-dir dist --project my-package
uv run cloudflare-pypi publish \
  --dist-dir dist \
  --project my-package \
  --bucket python-index \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Set credentials with either CLI flags or environment variables:

```bash
AWS_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
```

## GitHub Actions

```yaml
- uses: your-org/cloudflare-pypi-index/actions/publish@v1
  with:
    dist-dir: dist
    project: my-package
    bucket: python-index
    worker-name: python-index
    queue: python-index-event-queue
    endpoint-url: https://${{ secrets.CF_ACCOUNT_ID }}.r2.cloudflarestorage.com
    verify-index-url: https://packages.example.com/simple/
    admin-token: ${{ secrets.PACKAGE_INDEX_ADMIN_TOKEN }}
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
```

By default the action deploys the Worker infra first: it renders
`cloudflare/wrangler.toml`, ensures the R2 bucket and Queue exist, deploys the
Worker, and ensures R2 event notifications exist. Set `deploy-infra: "false"` to
publish only.

The index is private by default. Set `public-index: "true"` only if anonymous
reads of `/simple/*` and `/packages/*` should be allowed.

## Worker deployment

Copy the example config first:

```bash
cp cloudflare/wrangler.example.toml cloudflare/wrangler.toml
```

Then edit `bucket_name`, `queue`, and `name` for the target project.

Keep these binding names unchanged because the Worker code depends on them:

```toml
[[r2_buckets]]
binding = "INDEX_BUCKET"

[[durable_objects.bindings]]
name = "PROJECT_INDEX"
class_name = "ProjectIndexDO"
```

Install and check the Worker:

```bash
npm --prefix cloudflare install
npm --prefix cloudflare run typecheck
```

Set the admin token used by manual rebuild requests:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Deploy:

```bash
npm --prefix cloudflare run deploy
```

The deploy script ensures the configured R2 bucket and Queue exist, deploys the
Worker, and then ensures R2 event notifications exist. To create notifications
separately:

```bash
npm --prefix cloudflare run notifications:create
```

The script reads `bucket_name` from `cloudflare/wrangler.toml` and `queue` from
`[[queues.consumers]]`. You can still override them with `--bucket`, `--queue`,
`R2_BUCKET`, or `R2_QUEUE`.

List configured notification rules:

```bash
npm --prefix cloudflare run notifications:list
```

Delete notification rules for the configured Queue:

```bash
npm --prefix cloudflare run notifications:delete
```

Delete a single rule:

```bash
npm --prefix cloudflare run notifications:delete -- --rule <RULE_ID>
```

Manual rebuild is always available:

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://<WORKER_HOST>/admin/rebuild/<PROJECT_NAME>
```

## Basic Auth

The index is private by default. Create an account with the admin API:

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"ci"}' \
  https://<WORKER_HOST>/admin/auth/accounts
```

The response includes a generated token once. Store it securely:

```json
{
  "name": "ci",
  "token": "cfpi_...",
  "tokenPrefix": "cfpi_..."
}
```

`cfpi_...` tokens are package account tokens for Basic Auth. They are not
Cloudflare API tokens or R2 S3 access keys.

Use the account name as the Basic Auth username and the generated token as the
password:

```bash
uv add <PROJECT_NAME> --index https://ci:<TOKEN>@<WORKER_HOST>/simple/
```

Manage accounts:

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://<WORKER_HOST>/admin/auth/accounts

curl -X DELETE \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://<WORKER_HOST>/admin/auth/accounts/ci
```

To make the index public, set:

```toml
[vars]
PUBLIC_INDEX = "true"
```

or pass this action input:

```yaml
public-index: "true"
```

## End-to-end publish

Build and publish a package:

```bash
uv run python -m build

uv run cloudflare-pypi check-dist \
  --dist-dir dist \
  --project <PROJECT_NAME>

AWS_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID> \
AWS_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY> \
uv run cloudflare-pypi publish \
  --dist-dir dist \
  --project <PROJECT_NAME> \
  --bucket <BUCKET_NAME> \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

If Queue notifications are not enabled, rebuild explicitly after publish:

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://<WORKER_HOST>/admin/rebuild/<PROJECT_NAME>
```

Verify the package is indexed:

```bash
uv run cloudflare-pypi verify \
  --project <PROJECT_NAME> \
  --index-url https://<WORKER_HOST>/simple/ \
  --filename <DISTRIBUTION_FILENAME>

uv add <PROJECT_NAME> --index https://<WORKER_HOST>/simple/
```

See `docs/` and `examples/` for more detailed setup notes.

## Releases

This repository uses semantic-release to create GitHub Releases and semver tags.
It does not publish npm or PyPI packages by default. See `docs/release.md`.
