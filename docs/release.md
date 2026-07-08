# Release

This repository uses semantic-release to create GitHub releases and semver tags.
It does not publish npm packages, PyPI packages, or binary release assets.

The GitHub Actions workflow passes `repositoryUrl` from `github.repository`, so
the repository does not need a hard-coded owner/name in `.releaserc.json`.

Use Conventional Commits:

```text
feat: add action input
fix: make notification creation idempotent
docs: update deployment instructions
feat!: change action input names
```

Release artifacts:

- `vX.Y.Z` Git tag
- GitHub Release
- Generated release notes

Action users can reference immutable tags:

```yaml
- uses: your-org/cloudflare-pypi-index/actions/publish@v1.2.3
```

Maintain a floating major tag manually when cutting stable releases:

```bash
git tag -f v1 v1.2.3
git push -f origin v1
```
