import { generateToken, hashToken, tokenPrefix, verifyTokenHash } from "./auth.mjs";
import { Env } from "./shared";

interface AccountRecord {
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
  disabled: boolean;
}

export class AuthStoreDO {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/accounts") {
      return this.listAccounts();
    }
    if (request.method === "GET" && url.pathname === "/enabled") {
      return this.isEnabled();
    }
    if (request.method === "POST" && url.pathname === "/accounts") {
      return this.createAccount(request);
    }
    if (request.method === "DELETE" && url.pathname.startsWith("/accounts/")) {
      return this.deleteAccount(decodeURIComponent(url.pathname.replace("/accounts/", "")));
    }
    if (request.method === "POST" && url.pathname === "/verify") {
      return this.verifyAccount(request);
    }
    return new Response("Not Found", { status: 404 });
  }

  private async listAccounts(): Promise<Response> {
    const listed = await this.state.storage.list<AccountRecord>({ prefix: "account:" });
    const accounts = [...listed.values()].map(({ tokenHash: _tokenHash, ...account }) => account);
    accounts.sort((left, right) => left.name.localeCompare(right.name));
    return Response.json({ accounts });
  }

  private async isEnabled(): Promise<Response> {
    const listed = await this.state.storage.list<AccountRecord>({
      prefix: "account:",
      limit: 1,
    });
    return Response.json({ enabled: listed.size > 0 });
  }

  private async createAccount(request: Request): Promise<Response> {
    const body = await request.json<{ name?: string }>().catch(() => null);
    const name = normalizeAccountName(body?.name ?? "");
    if (!name) {
      return Response.json({ error: "Invalid account name" }, { status: 400 });
    }

    const token = generateToken();
    const now = new Date().toISOString();
    const account: AccountRecord = {
      name,
      tokenHash: await hashToken(token),
      tokenPrefix: tokenPrefix(token),
      createdAt: now,
      disabled: false,
    };
    await this.state.storage.put(accountKey(name), account);

    return Response.json(
      {
        name,
        token,
        tokenPrefix: account.tokenPrefix,
        createdAt: account.createdAt,
        disabled: account.disabled,
      },
      { status: 201 },
    );
  }

  private async deleteAccount(name: string): Promise<Response> {
    const normalized = normalizeAccountName(name);
    if (!normalized) {
      return Response.json({ error: "Invalid account name" }, { status: 400 });
    }
    await this.state.storage.delete(accountKey(normalized));
    return Response.json({ ok: true, name: normalized });
  }

  private async verifyAccount(request: Request): Promise<Response> {
    const body = await request.json<{ username?: string; token?: string }>().catch(() => null);
    const username = normalizeAccountName(body?.username ?? "");
    const token = body?.token ?? "";
    if (!username || !token) {
      return Response.json({ ok: false }, { status: 401 });
    }

    const account = await this.state.storage.get<AccountRecord>(accountKey(username));
    if (!account || account.disabled || !(await verifyTokenHash(token, account.tokenHash))) {
      return Response.json({ ok: false }, { status: 401 });
    }

    account.lastUsedAt = new Date().toISOString();
    await this.state.storage.put(accountKey(username), account);
    return Response.json({ ok: true, username });
  }
}

function accountKey(name: string): string {
  return `account:${name}`;
}

function normalizeAccountName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}
