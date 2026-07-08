from __future__ import annotations

import argparse
import os
import sys
import urllib.request
from typing import TextIO

from .distributions import DistributionError, discover_distributions
from .publisher import DuplicateObjectError, PublishOptions, publish_distributions
from .storage import Boto3R2Storage


def main(
    argv: list[str] | None = None,
    *,
    stdout: TextIO = sys.stdout,
    stderr: TextIO = sys.stderr,
) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "check-dist":
            return _check_dist(args, stdout)
        if args.command == "publish":
            return _publish(args, stdout, stderr)
        if args.command == "verify":
            return _verify(args, stdout, stderr)
    except (DistributionError, DuplicateObjectError, ValueError) as exc:
        print(f"error: {exc}", file=stderr)
        return 1

    parser.print_help(stderr)
    return 2


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cloudflare-pypi")
    subcommands = parser.add_subparsers(dest="command")

    check = subcommands.add_parser("check-dist")
    check.add_argument("--dist-dir", default="dist")
    check.add_argument("--project", required=True)
    check.add_argument("--package-prefix", default="packages")
    check.add_argument("--requires-python")

    publish = subcommands.add_parser("publish")
    publish.add_argument("--dist-dir", default="dist")
    publish.add_argument("--project", required=True)
    publish.add_argument("--bucket")
    publish.add_argument("--endpoint-url")
    publish.add_argument("--package-prefix", default="packages")
    publish.add_argument("--requires-python")
    publish.add_argument("--access-key-id", default=os.environ.get("AWS_ACCESS_KEY_ID"))
    publish.add_argument("--secret-access-key", default=os.environ.get("AWS_SECRET_ACCESS_KEY"))
    publish.add_argument("--allow-existing", action="store_true")
    publish.add_argument("--dry-run", action="store_true")

    verify = subcommands.add_parser("verify")
    verify.add_argument("--project", required=True)
    verify.add_argument("--index-url", required=True)
    verify.add_argument("--filename", required=True)

    return parser


def _check_dist(args: argparse.Namespace, stdout: TextIO) -> int:
    files = discover_distributions(
        args.dist_dir,
        args.project,
        package_prefix=args.package_prefix,
        requires_python=args.requires_python,
    )
    for file in files:
        print(f"{file.key} sha256={file.metadata['sha256']}", file=stdout)
    return 0


def _publish(args: argparse.Namespace, stdout: TextIO, stderr: TextIO) -> int:
    if not args.bucket:
        print("error: --bucket is required", file=stderr)
        return 2
    if not args.endpoint_url:
        print("error: --endpoint-url is required", file=stderr)
        return 2

    files = discover_distributions(
        args.dist_dir,
        args.project,
        package_prefix=args.package_prefix,
        requires_python=args.requires_python,
    )
    options = PublishOptions(fail_on_existing=not args.allow_existing, dry_run=args.dry_run)

    if args.dry_run:
        for file in files:
            print(f"DRY-RUN upload {file.key}", file=stdout)
        return 0

    storage = Boto3R2Storage(
        bucket=args.bucket,
        endpoint_url=args.endpoint_url,
        access_key_id=args.access_key_id,
        secret_access_key=args.secret_access_key,
    )
    result = publish_distributions(storage, files, options)
    for key in result.uploaded:
        print(f"uploaded {key}", file=stdout)
    for key in result.skipped:
        print(f"skipped existing {key}", file=stdout)
    return 0


def _verify(args: argparse.Namespace, stdout: TextIO, stderr: TextIO) -> int:
    base = args.index_url.rstrip("/")
    project_url = f"{base}/{args.project.strip('/')}/"
    try:
        with urllib.request.urlopen(project_url, timeout=20) as response:
            body = response.read().decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"error: failed to fetch {project_url}: {exc}", file=stderr)
        return 1

    if args.filename not in body:
        print(f"error: {args.filename} not found in {project_url}", file=stderr)
        return 1

    print(f"verified {args.filename} in {project_url}", file=stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
