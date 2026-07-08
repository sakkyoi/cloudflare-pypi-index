import { Env, escapeHtml, htmlPage } from "./shared";

interface ProjectFile {
  filename: string;
  key: string;
  sha256: string;
  requiresPython?: string;
  uploaded: string;
}

export class ProjectIndexDO {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const project = url.searchParams.get("project");
    if (!project) {
      return new Response("Missing project", { status: 400 });
    }

    await this.state.blockConcurrencyWhile(async () => {
      await this.rebuildProject(project);
      await this.rebuildRoot();
    });

    return Response.json({ ok: true, project });
  }

  private async rebuildProject(project: string): Promise<void> {
    const files = await this.listProjectFiles(project);
    const htmlKey = `_index/simple/${project}/index.html`;
    const jsonKey = `_index/simple/${project}/index.v1.json`;
    const markerKey = `_control/projects/${project}.json`;

    if (files.length === 0) {
      await this.env.INDEX_BUCKET.delete([htmlKey, jsonKey, markerKey]);
      return;
    }

    const links = files.map((file) => {
      const attrs = [
        `href="/${escapeHtml(file.key)}#sha256=${file.sha256}"`,
      ];
      if (file.requiresPython) {
        attrs.push(`data-requires-python="${escapeHtml(file.requiresPython)}"`);
      }
      return `<a ${attrs.join(" ")}>${escapeHtml(file.filename)}</a><br>`;
    });

    await this.env.INDEX_BUCKET.put(htmlKey, htmlPage(links.join("\n")), {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });
    await this.env.INDEX_BUCKET.put(
      jsonKey,
      JSON.stringify(
        {
          meta: { "api-version": "1.4" },
          name: project,
          files: files.map((file) => ({
            filename: file.filename,
            url: `/${file.key}`,
            hashes: { sha256: file.sha256 },
            "requires-python": file.requiresPython,
            "upload-time": file.uploaded,
          })),
        },
        null,
        2,
      ),
      { httpMetadata: { contentType: "application/vnd.pypi.simple.v1+json" } },
    );
    await this.env.INDEX_BUCKET.put(
      markerKey,
      JSON.stringify({ name: project, updated: new Date().toISOString() }),
      { httpMetadata: { contentType: "application/json" } },
    );
  }

  private async listProjectFiles(project: string): Promise<ProjectFile[]> {
    const prefix = `packages/${project}/`;
    const files: ProjectFile[] = [];
    let cursor: string | undefined;

    do {
      const listed = await this.env.INDEX_BUCKET.list({ prefix, cursor });
      for (const object of listed.objects) {
        const head = await this.env.INDEX_BUCKET.head(object.key);
        const metadata = head?.customMetadata ?? {};
        const filename = object.key.slice(prefix.length);
        const sha256 = metadata.sha256;
        if (!filename || !sha256 || metadata.project !== project) continue;

        files.push({
          filename,
          key: object.key,
          sha256,
          requiresPython: metadata["requires-python"],
          uploaded: object.uploaded.toISOString(),
        });
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    return files.sort((left, right) => left.filename.localeCompare(right.filename));
  }

  private async rebuildRoot(): Promise<void> {
    const projects: string[] = [];
    let cursor: string | undefined;

    do {
      const listed = await this.env.INDEX_BUCKET.list({
        prefix: "_control/projects/",
        cursor,
      });
      for (const object of listed.objects) {
        const name = object.key
          .replace("_control/projects/", "")
          .replace(/\.json$/, "");
        if (name) projects.push(name);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    projects.sort();
    const links = projects.map(
      (project) => `<a href="/simple/${escapeHtml(project)}/">${escapeHtml(project)}</a><br>`,
    );

    await this.env.INDEX_BUCKET.put("_index/simple/index.html", htmlPage(links.join("\n")), {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });
    await this.env.INDEX_BUCKET.put(
      "_index/simple/index.v1.json",
      JSON.stringify(
        {
          meta: { "api-version": "1.4" },
          projects: projects.map((name) => ({ name })),
        },
        null,
        2,
      ),
      { httpMetadata: { contentType: "application/vnd.pypi.simple.v1+json" } },
    );
  }
}
