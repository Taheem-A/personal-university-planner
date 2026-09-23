import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";

function loadAuthModule(db, getSession = async () => null) {
  const source = readFileSync("apps/web/src/server/auth.ts", "utf8");
  const javascript = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const nativeRequire = createRequire(import.meta.url);
  const require = (specifier) => {
    if (specifier === "next-auth") return { getServerSession: getSession };
    if (specifier === "next-auth/providers/google")
      return (options) => ({ id: "google", ...options });
    if (specifier === "./database") return { applicationDatabase: () => db };
    return nativeRequire(specifier);
  };
  vm.runInNewContext(javascript, { exports, require, process, Error });
  return exports;
}

function fixture() {
  const accounts = new Map();
  let count = 0;
  return {
    accounts,
    db: {
      repositories: {
        authIdentities: {
          async provisionUser(provider, accountId) {
            const key = `${provider}:${accountId}`;
            if (!accounts.has(key)) accounts.set(key, { id: `user-${++count}` });
            return accounts.get(key);
          },
        },
        users: {
          async getById(id) {
            return [...accounts.values()].find((user) => user.id === id) ?? null;
          },
        },
      },
    },
  };
}

test("Google authentication provisions once, keeps login scope minimal, and omits secrets from session", async () => {
  const prior = [
    process.env.AUTH_SECRET,
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  ];
  process.env.AUTH_SECRET = "a".repeat(40);
  process.env.AUTH_GOOGLE_ID = "synthetic-client";
  process.env.AUTH_GOOGLE_SECRET = "synthetic-secret";
  try {
    const { db, accounts } = fixture();
    const { createAuthOptions, GOOGLE_LOGIN_SCOPE } = loadAuthModule(db);
    const options = createAuthOptions(db);
    assert.equal(GOOGLE_LOGIN_SCOPE, "openid");
    assert.equal(options.providers[0].authorization.params.scope, "openid");
    assert.equal(
      await options.callbacks.signIn({ account: { provider: "google", providerAccountId: "one" } }),
      true,
    );
    assert.equal(
      await options.callbacks.signIn({ account: { provider: "google", providerAccountId: "one" } }),
      true,
    );
    assert.equal(
      await options.callbacks.signIn({ account: { provider: "other", providerAccountId: "one" } }),
      false,
    );
    const token = await options.callbacks.jwt({
      token: { name: "Private", email: "private@example.com", picture: "url" },
      account: {
        provider: "google",
        providerAccountId: "one",
        access_token: "secret-access",
        refresh_token: "secret-refresh",
      },
    });
    assert.equal(token.userId, "user-1");
    assert.equal(accounts.size, 1);
    assert.equal(token.email, undefined);
    const session = await options.callbacks.session({
      session: { expires: "tomorrow", user: { email: "private@example.com" } },
      token,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(session.user)), { id: "user-1" });
    assert.doesNotMatch(JSON.stringify(session), /private|secret|access_token|refresh_token/);
  } finally {
    [process.env.AUTH_SECRET, process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET] = prior;
  }
});

test("authenticated context rejects missing and deleted users", async () => {
  const prior = [
    process.env.AUTH_SECRET,
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  ];
  process.env.AUTH_SECRET = "b".repeat(40);
  process.env.AUTH_GOOGLE_ID = "synthetic-client";
  process.env.AUTH_GOOGLE_SECRET = "synthetic-secret";
  try {
    const { db } = fixture();
    assert.equal(await loadAuthModule(db).authenticatedActor(), null);
    assert.equal(
      await loadAuthModule(db, async () => ({ user: { id: "deleted" } })).authenticatedActor(),
      null,
    );
    await db.repositories.authIdentities.provisionUser("google", "one");
    assert.deepEqual(
      JSON.parse(
        JSON.stringify(
          await loadAuthModule(db, async () => ({ user: { id: "user-1" } })).authenticatedActor(),
        ),
      ),
      { userId: "user-1" },
    );
  } finally {
    [process.env.AUTH_SECRET, process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET] = prior;
  }
});
