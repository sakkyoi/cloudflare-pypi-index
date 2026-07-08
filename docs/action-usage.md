# GitHub Action Usage

The action wraps the same `cloudflare-pypi publish` command used locally.

```yaml
name: Publish package

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-python@v6
        with:
          python-version: "3.13"

      - run: python -m pip install --upgrade build
      - run: python -m build

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
          # Optional. Defaults to "false".
          public-index: "false"
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
```

The action deploys infra by default. It creates `cloudflare/wrangler.toml` from
inputs, ensures the R2 bucket and Queue exist, deploys the Worker, ensures R2
notifications, then publishes distributions to R2.

The index is private by default. Set `public-index: "true"` only when anonymous
reads should be allowed.

Required secrets:

```text
CLOUDFLARE_API_TOKEN
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
PACKAGE_INDEX_ADMIN_TOKEN
```

`CLOUDFLARE_API_TOKEN` must be able to deploy Workers, manage Queues, manage R2
buckets, manage R2 bucket notifications, and write Worker secrets. The R2 access
key pair is used only by the publisher upload step.

Use `allow-existing: "true"` only for idempotent reruns where skipping existing
objects is acceptable. The default fails on existing objects to avoid silently
overwriting released artifacts.
