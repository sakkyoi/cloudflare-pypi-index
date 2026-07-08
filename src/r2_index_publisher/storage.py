from __future__ import annotations

from pathlib import Path


class Boto3R2Storage:
    def __init__(
        self,
        *,
        bucket: str,
        endpoint_url: str,
        access_key_id: str | None = None,
        secret_access_key: str | None = None,
        region_name: str = "auto",
    ) -> None:
        import boto3

        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region_name,
        )

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception as exc:
            response = getattr(exc, "response", {})
            status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if status == 404:
                return False
            error_code = response.get("Error", {}).get("Code")
            if error_code in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise

    def upload_file(
        self,
        source: Path,
        key: str,
        metadata: dict[str, str],
        content_type: str,
    ) -> None:
        self.client.upload_file(
            str(source),
            self.bucket,
            key,
            ExtraArgs={
                "Metadata": metadata,
                "ContentType": content_type,
            },
        )
