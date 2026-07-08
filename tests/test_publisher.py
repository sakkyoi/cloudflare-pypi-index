import tempfile
import unittest
from pathlib import Path

from r2_index_publisher.distributions import discover_distributions
from r2_index_publisher.publisher import DuplicateObjectError, PublishOptions, publish_distributions


class FakeStorage:
    def __init__(self, existing=None):
        self.existing = set(existing or [])
        self.uploads = []

    def exists(self, key):
        return key in self.existing

    def upload_file(self, source, key, metadata, content_type):
        self.uploads.append(
            {
                "source": Path(source),
                "key": key,
                "metadata": metadata,
                "content_type": content_type,
            }
        )
        self.existing.add(key)


class PublisherTests(unittest.TestCase):
    def test_publishes_distributions_with_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            wheel = dist / "my_package-1.2.3-py3-none-any.whl"
            wheel.write_bytes(b"wheel-content")
            files = discover_distributions(dist, "my-package")
            storage = FakeStorage()

            result = publish_distributions(storage, files, PublishOptions(fail_on_existing=True))

        self.assertEqual(result.uploaded, ["packages/my-package/my_package-1.2.3-py3-none-any.whl"])
        self.assertEqual(storage.uploads[0]["metadata"]["project"], "my-package")
        self.assertEqual(storage.uploads[0]["metadata"]["filename"], wheel.name)
        self.assertEqual(storage.uploads[0]["content_type"], "application/octet-stream")

    def test_fails_when_object_exists_and_fail_on_existing_is_enabled(self):
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            wheel = dist / "my_package-1.2.3-py3-none-any.whl"
            wheel.write_bytes(b"wheel-content")
            files = discover_distributions(dist, "my-package")
            storage = FakeStorage(existing=[files[0].key])

            with self.assertRaises(DuplicateObjectError):
                publish_distributions(storage, files, PublishOptions(fail_on_existing=True))

        self.assertEqual(storage.uploads, [])


if __name__ == "__main__":
    unittest.main()
