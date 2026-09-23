import type { Database } from "@university-planner/database";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import { applicationDatabase } from "./database";

export const GOOGLE_LOGIN_SCOPE = "openid";

function authConfiguration() {
  const { AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET } = process.env;
  if (!AUTH_SECRET || AUTH_SECRET.length < 32 || !AUTH_GOOGLE_ID || !AUTH_GOOGLE_SECRET) {
    throw new Error("Auth.js Google credentials and a strong AUTH_SECRET are required.");
  }
  return { secret: AUTH_SECRET, clientId: AUTH_GOOGLE_ID, clientSecret: AUTH_GOOGLE_SECRET };
}

/** Exported factory permits callback testing without live Google OAuth or ambient database. */
export function createAuthOptions(database: Database | (() => Database)): NextAuthOptions {
  const credentials = authConfiguration();
  const resolveDatabase = () => (typeof database === "function" ? database() : database);
  return {
    secret: credentials.secret,
    session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
    providers: [
      Google({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        authorization: { params: { scope: GOOGLE_LOGIN_SCOPE } },
      }),
    ],
    callbacks: {
      async signIn({ account }) {
        if (account?.provider !== "google" || !account.providerAccountId) return false;
        await resolveDatabase().repositories.authIdentities.provisionUser(
          "google",
          account.providerAccountId,
        );
        return true;
      },
      async jwt({ token, account }) {
        if (account?.provider === "google" && account.providerAccountId) {
          const user = await resolveDatabase().repositories.authIdentities.provisionUser(
            "google",
            account.providerAccountId,
          );
          token.userId = user.id;
          // Do not retain OAuth profile attributes in the encrypted session token.
          delete token.email;
          delete token.name;
          delete token.picture;
        }
        return token;
      },
      async session({ session, token }) {
        session.user = { id: typeof token.userId === "string" ? token.userId : "" };
        return session;
      },
    },
  };
}

export function authOptions(): NextAuthOptions {
  return createAuthOptions(applicationDatabase);
}

/** Reject revoked/deleted users even while their signed JWT remains unexpired. */
export async function authenticatedActor(): Promise<{ userId: string } | null> {
  const session = await getServerSession(authOptions());
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await applicationDatabase().repositories.users.getById(userId);
  return user ? { userId: user.id } : null;
}
