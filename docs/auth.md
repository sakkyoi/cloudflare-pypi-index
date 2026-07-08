# Basic Auth

Cloudflare PyPI Index can protect `/simple/*` and `/packages/*` with Basic Auth.
The admin API remains protected by `ADMIN_TOKEN`.

The package index is private by default. `/simple/*` and `/packages/*` require
Basic Auth unless `PUBLIC_INDEX = "true"` is configured.

## Create an account

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"ci"}' \
  https://packages.example.com/admin/auth/accounts
```

The response contains a generated token. It is only returned once.

```json
{
  "name": "ci",
  "token": "cfpi_...",
  "tokenPrefix": "cfpi_...",
  "createdAt": "2026-07-08T00:00:00.000Z",
  "disabled": false
}
```

`cfpi_...` tokens are package account tokens for Basic Auth. They are not
Cloudflare API tokens and they are not R2 S3 access keys.

Use:

```text
username = account name
password = generated token
```

## Install packages

```bash
uv add my-package --index https://ci:<TOKEN>@packages.example.com/simple/
```

```bash
pip install --index-url https://ci:<TOKEN>@packages.example.com/simple/ my-package
```

Do not commit tokens in config files. Use CI secrets when constructing package
index URLs.

## Public index mode

To allow anonymous reads, set:

```toml
[vars]
PUBLIC_INDEX = "true"
```

or with the GitHub Action:

```yaml
with:
  public-index: "true"
```

Admin endpoints remain protected by `ADMIN_TOKEN`.

## List accounts

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://packages.example.com/admin/auth/accounts
```

List responses include token prefixes and timestamps, not full tokens.

## Delete an account

```bash
curl -X DELETE \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://packages.example.com/admin/auth/accounts/ci
```
