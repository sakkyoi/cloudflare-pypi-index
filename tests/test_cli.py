import tempfile
import unittest
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from r2_index_publisher.cli import main


class CliTests(unittest.TestCase):
    def test_check_dist_reports_discovered_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            (dist / "my_package-1.2.3-py3-none-any.whl").write_bytes(b"content")
            output = StringIO()

            code = main(
                ["check-dist", "--dist-dir", str(dist), "--project", "my-package"],
                stdout=output,
            )

        self.assertEqual(code, 0)
        self.assertIn("packages/my-package/my_package-1.2.3-py3-none-any.whl", output.getvalue())

    def test_publish_dry_run_does_not_create_storage_client(self):
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            (dist / "my_package-1.2.3-py3-none-any.whl").write_bytes(b"content")
            output = StringIO()

            with patch("r2_index_publisher.cli.Boto3R2Storage") as storage_class:
                code = main(
                    [
                        "publish",
                        "--dist-dir",
                        str(dist),
                        "--project",
                        "my-package",
                        "--bucket",
                        "python-index",
                        "--endpoint-url",
                        "https://example.r2.cloudflarestorage.com",
                        "--dry-run",
                    ],
                    stdout=output,
                )

        self.assertEqual(code, 0)
        storage_class.assert_not_called()
        self.assertIn("DRY-RUN upload packages/my-package/my_package-1.2.3-py3-none-any.whl", output.getvalue())

    def test_publish_requires_bucket(self):
        output = StringIO()
        code = main(["publish", "--project", "my-package"], stdout=output, stderr=output)

        self.assertEqual(code, 2)
        self.assertIn("--bucket is required", output.getvalue())


if __name__ == "__main__":
    unittest.main()
