import { ProjectIndexDO } from "./project-index-do";
import { AuthStoreDO } from "./auth-store-do";
import { Env, parsePackageKey } from "./shared";
import { handleQueue } from "./queue-consumer";

export { ProjectIndexDO };
export { AuthStoreDO };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/admin/rebuild/")) {
      return rebuildFromAdminRequest(request, env, url);
    }
    if (url.pathname.startsWith("/admin/auth/")) {
      return authAdminRequest(request, env, url);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    const key = keyForPublicPath(url.pathname);
    if (!key) {
      return new Response("Not Found", { status: 404 });
    }

    const authResult = await authorizePackageRequest(request, env);
    if (authResult) return authResult;

    const object = await env.INDEX_BUCKET.get(key, {
      onlyIf: request.headers,
      range: request.headers,
    });
    if (object === null) {
      return new Response("Not Found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", cacheControlForKey(key));

    const hasBody = "body" in object;
    return new Response(request.method === "HEAD" || !hasBody ? null : object.body, {
      status: hasBody ? 200 : 412,
      headers,
    });
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    await handleQueue(batch as MessageBatch<any>, env);
  },
};

function keyForPublicPath(pathname: string): string | null {
  if (pathname === "/") return "_index/simple/index.html";
  if (pathname === "/simple" || pathname === "/simple/") return "_index/simple/index.html";

  const simpleProject = pathname.match(/^\/simple\/([^/]+)\/?$/);
  if (simpleProject) return `_index/simple/${simpleProject[1]}/index.html`;

  if (parsePackageKey(pathname.replace(/^\/+/, ""))) {
    return pathname.replace(/^\/+/, "");
  }

  return null;
}

async function rebuildFromAdminRequest(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "POST" },
    });
  }
  const auth = request.headers.get("authorization");
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const project = url.pathname.replace("/admin/rebuild/", "").replace(/\/+$/, "");
  if (!project) return new Response("Missing project", { status: 400 });

  const id = env.PROJECT_INDEX.idFromName(project);
  const stub = env.PROJECT_INDEX.get(id);
  return stub.fetch(`https://internal/rebuild?project=${encodeURIComponent(project)}`);
}

async function authAdminRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const auth = request.headers.get("authorization");
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stub = authStore(env);
  const path = url.pathname.replace("/admin/auth", "");
  return stub.fetch(new Request(`https://auth-store${path}`, request));
}

async function authorizePackageRequest(request: Request, env: Env): Promise<Response | null> {
  const enabled = await authStore(env).fetch("https://auth-store/enabled");
  const enabledBody = await enabled.json<{ enabled?: boolean }>().catch(() => ({ enabled: true }));
  if (!enabledBody.enabled) return null;

  const credentials = basicCredentials(request.headers.get("authorization"));
  if (!credentials) return unauthorized();

  const response = await authStore(env).fetch(
    new Request("https://auth-store/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    }),
  );
  if (response.ok) return null;
  return unauthorized();
}

function authStore(env: Env): DurableObjectStub {
  const id = env.AUTH_STORE.idFromName("global");
  return env.AUTH_STORE.get(id);
}

function basicCredentials(header: string | null): { username: string; token: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      token: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="Python package index"',
    },
  });
}

function cacheControlForKey(key: string): string {
  if (key.startsWith("packages/")) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=30";
}
