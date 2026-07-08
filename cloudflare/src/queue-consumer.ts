import { Env, R2EventBody, parsePackageKey } from "./shared";

export async function handleQueue(batch: MessageBatch<R2EventBody>, env: Env): Promise<void> {
  const projects = new Set<string>();

  for (const message of batch.messages) {
    const parsed = parsePackageKey(message.body.object.key);
    if (!parsed) continue;
    projects.add(parsed.project);
  }

  await Promise.all(
    [...projects].map((project) => {
      const id = env.PROJECT_INDEX.idFromName(project);
      const stub = env.PROJECT_INDEX.get(id);
      return stub.fetch(`https://internal/rebuild?project=${encodeURIComponent(project)}`);
    }),
  );
}
