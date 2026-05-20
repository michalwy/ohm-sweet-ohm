import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

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
    enabled: true,
    disableSignUp: process.env.OSO_AUTH_ALLOW_SIGN_UP !== "1"
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
