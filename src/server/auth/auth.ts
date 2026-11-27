import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { canCreateAccount } from "@/server/auth/registration";
import { prisma } from "@/server/db/prisma";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: getAuthSecret(),
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  user: {
    modelName: "User"
  },
  session: {
    modelName: "Session"
  },
  account: {
    modelName: "Account"
  },
  verification: {
    modelName: "Verification"
  },
  emailAndPassword: {
    enabled: true
  },
  databaseHooks: {
    user: {
      create: {
        // Registration is closed by default (#323); this guards the sign-up API as well as the page.
        before: async () => {
          if (!(await canCreateAccount())) {
            throw new APIError("FORBIDDEN", { message: "Registration is closed." });
          }
        }
      }
    }
  },
  plugins: [nextCookies()]
});

function getAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }

  return "ohm-sweet-ohm-local-development-auth-secret";
}
