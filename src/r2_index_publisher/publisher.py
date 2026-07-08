from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

from .distributions import DistributionFile


class StorageClient(Protocol):
    def exists(self, key: str) -> bool:
        ...

    def upload_file(
        self,
        source: Path,
        key: str,
        metadata: dict[str, str],
        content_type: str,
    ) -> None:
        ...


class DuplicateObjectError(RuntimeError):
    pass


@dataclass(frozen=True)
class PublishOptions:
    fail_on_existing: bool = True
    dry_run: bool = False


@dataclass
class PublishResult:
    uploaded: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def publish_distributions(
    storage: StorageClient,
    distributions: list[DistributionFile],
    options: PublishOptions,
) -> PublishResult:
    result = PublishResult()

    for distribution in distributions:
        if storage.exists(distribution.key):
            if options.fail_on_existing:
                raise DuplicateObjectError(f"Object already exists: {distribution.key}")
            result.skipped.append(distribution.key)
            continue

        if not options.dry_run:
            storage.upload_file(
                distribution.path,
                distribution.key,
                distribution.metadata,
                "application/octet-stream",
            )
        result.uploaded.append(distribution.key)

    return result
