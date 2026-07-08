# Local Usage

Install for development:

```bash
uv sync
npm --prefix cloudflare install
node cloudflare/scripts/render-wrangler-config.mjs \
  --worker-name python-index \
  --bucket python-index \
  --queue python-index-event-queue
```

Deploy local project infrastructure:

```bash
npm --prefix cloudflare run deploy
```

Validate distributions:

```bash
uv run cloudflare-pypi check-dist --dist-dir dist --project my-package
```

Dry-run publish:

```bash
uv run cloudflare-pypi publish \
  --dist-dir dist \
  --project my-package \
  --bucket python-index \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  --dry-run
```

Publish:

```bash
AWS_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID> \
AWS_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY> \
uv run cloudflare-pypi publish \
  --dist-dir dist \
  --project my-package \
  --bucket python-index \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Verify an indexed file:

```bash
uv run cloudflare-pypi verify \
  --project my-package \
  --index-url https://packages.example.com/simple/ \
  --filename my_package-1.2.3-py3-none-any.whl
```

Manually rebuild one project:

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://packages.example.com/admin/rebuild/my-package
```

Create a package account to enable Basic Auth:

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"ci"}' \
  https://packages.example.com/admin/auth/accounts
```

Use the returned token:

```bash
uv add my-package --index https://ci:<TOKEN>@packages.example.com/simple/
```
