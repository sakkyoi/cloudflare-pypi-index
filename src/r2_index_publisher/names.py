import re


def normalize_project_name(name: str) -> str:
    normalized = re.sub(r"[-_.]+", "-", name).lower().strip("-")
    if not normalized:
        raise ValueError("Project name cannot be empty")
    return normalized
