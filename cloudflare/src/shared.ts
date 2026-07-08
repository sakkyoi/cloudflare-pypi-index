export interface Env {
  INDEX_BUCKET: R2Bucket;
  PROJECT_INDEX: DurableObjectNamespace;
  ADMIN_TOKEN?: string;
}

export interface R2EventBody {
  action: string;
  object: {
    key: string;
    size?: number;
    eTag?: string;
  };
  eventTime: string;
}

export function parsePackageKey(key: string): { project: string; filename: string } | null {
  const match = key.match(/^packages\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { project: match[1], filename: match[2] };
}

export function htmlPage(body: string): string {
  return `<!doctype html>
<html>
<head><meta name="pypi:repository-version" content="1.4"></head>
<body>
${body}
</body>
</html>
`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
