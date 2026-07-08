from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Iterable

from .names import normalize_project_name


class DistributionError(ValueError):
    pass


@dataclass(frozen=True)
class DistributionFile:
    path: Path
    project: str
    filename: str
    key: str
    metadata: dict[str, str]


def discover_distributions(
    dist_dir: str | Path,
    project: str,
    *,
    package_prefix: str = "packages",
    requires_python: str | None = None,
) -> list[DistributionFile]:
    dist_path = Path(dist_dir)
    normalized_project = normalize_project_name(project)
    if not dist_path.is_dir():
        raise DistributionError(f"Distribution directory does not exist: {dist_path}")

    files = sorted(_iter_distribution_files(dist_path), key=lambda item: item.name)
    if not files:
        raise DistributionError(f"No distributions found in {dist_path}")

    discovered = []
    for path in files:
        inferred_project = _project_from_filename(path.name)
        if inferred_project != normalized_project:
            raise DistributionError(
                f"Distribution {path.name} does not match project {normalized_project}"
            )

        digest = _sha256_file(path)
        metadata = {
            "project": normalized_project,
            "filename": path.name,
            "sha256": digest,
        }
        if requires_python:
            metadata["requires-python"] = requires_python

        key = f"{package_prefix.strip('/')}/{normalized_project}/{path.name}"
        discovered.append(
            DistributionFile(
                path=path,
                project=normalized_project,
                filename=path.name,
                key=key,
                metadata=metadata,
            )
        )
    return discovered


def _iter_distribution_files(dist_path: Path) -> Iterable[Path]:
    for path in dist_path.iterdir():
        if path.is_file() and (
            path.name.endswith(".whl")
            or path.name.endswith(".tar.gz")
            or path.name.endswith(".zip")
        ):
            yield path


def _project_from_filename(filename: str) -> str:
    if filename.endswith(".whl"):
        return normalize_project_name(filename.split("-", 1)[0])
    if filename.endswith(".tar.gz"):
        stem = filename.removesuffix(".tar.gz")
    elif filename.endswith(".zip"):
        stem = filename.removesuffix(".zip")
    else:
        raise DistributionError(f"Unsupported distribution file: {filename}")
    return normalize_project_name(stem.rsplit("-", 1)[0])


def _sha256_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
