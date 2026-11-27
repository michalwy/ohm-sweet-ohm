import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { afterEach, describe, test } from "node:test";

import { auth } from "../../src/server/auth/auth";
import { canCreateAccount, isRegistrationOpen } from "../../src/server/auth/registration";
import { prisma } from "../../src/server/db/prisma";

const suffix = randomBytes(4).toString("hex");
const originalSetting = process.env.OSO_AUTH_ALLOW_SIGN_UP;

function signUp(label: string) {
  return auth.api.signUpEmail({
    body: { name: label, email: `${label}-${suffix}@example.test`, password: "correct-horse-battery" }
  });
}

describe("registration (#323)", () => {
  afterEach(() => {
    if (originalSetting === undefined) {
      delete process.env.OSO_AUTH_ALLOW_SIGN_UP;
    } else {
      process.env.OSO_AUTH_ALLOW_SIGN_UP = originalSetting;
    }
  });

  test("with the default configuration an instance that has accounts refuses sign-up", async () => {
    delete process.env.OSO_AUTH_ALLOW_SIGN_UP;
    // Make sure the instance has at least one account, whatever ran before.
    await prisma.user.create({ data: { email: `existing-${suffix}@example.test`, name: "Existing" } });

    assert.equal(await isRegistrationOpen(), false);
    assert.equal(await canCreateAccount(), false);
    await assert.rejects(() => signUp("closed"));
    assert.equal(await prisma.user.count({ where: { email: `closed-${suffix}@example.test` } }), 0);
  });

  test("with registration set to open, sign-up works", async () => {
    process.env.OSO_AUTH_ALLOW_SIGN_UP = "1";

    assert.equal(await isRegistrationOpen(), true);
    assert.equal(await canCreateAccount(), true);

    const result = await signUp("open");
    assert.equal(result.user.email, `open-${suffix}@example.test`);
  });
});
