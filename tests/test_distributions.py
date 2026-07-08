import tempfile
import unittest
from pathlib import Path

from r2_index_publisher.distributions import DistributionError, discover_distributions
from r2_index_publisher.names import normalize_project_name


class DistributionTests(unittest.TestCase):
    def test_normalizes_project_names(self):
        self.assertEqual(normalize_project_name("My.Package_Name"), "my-package-name")

    def test_discovers_project_distributions_with_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            wheel = dist / "my_package-1.2.3-py3-none-any.whl"
            sdist = dist / "my_package-1.2.3.tar.gz"
            wheel.write_bytes(b"wheel-content")
            sdist.write_bytes(b"sdist-content")

            files = discover_distributions(dist, "my-package", requires_python=">=3.10")

        self.assertEqual([item.filename for item in files], [wheel.name, sdist.name])
        self.assertEqual(files[0].project, "my-package")
        self.assertEqual(files[0].key, f"packages/my-package/{wheel.name}")
        self.assertEqual(files[0].metadata["requires-python"], ">=3.10")
        self.assertEqual(
            files[0].metadata["sha256"],
            "9f55861ef9cdad654f929a9a7d5d5d3eac57dd1feef166c607dcd1ed7fb8e954",
        )

    def test_rejects_file_that_does_not_match_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            (dist / "other_package-1.0.0-py3-none-any.whl").write_bytes(b"content")

            with self.assertRaisesRegex(DistributionError, "does not match project"):
                discover_distributions(dist, "my-package")


if __name__ == "__main__":
    unittest.main()
