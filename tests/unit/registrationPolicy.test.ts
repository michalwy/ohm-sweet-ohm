import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { canCreateAccountNow, isRegistrationOpenByDefault } from "../../src/server/auth/registrationPolicy";

describe("isRegistrationOpenByDefault", () => {
  test("is closed unless explicitly opened", () => {
    assert.equal(isRegistrationOpenByDefault({}), false);
    assert.equal(isRegistrationOpenByDefault({ OSO_AUTH_ALLOW_SIGN_UP: "" }), false);
    assert.equal(isRegistrationOpenByDefault({ OSO_AUTH_ALLOW_SIGN_UP: "0" }), false);
    assert.equal(isRegistrationOpenByDefault({ OSO_AUTH_ALLOW_SIGN_UP: "1" }), true);
  });
});

describe("canCreateAccountNow", () => {
  test("the first account is always allowed", () => {
    assert.equal(canCreateAccountNow({ registrationOpen: false, userCount: 0 }), true);
  });

  test("a later account needs open registration", () => {
    assert.equal(canCreateAccountNow({ registrationOpen: false, userCount: 1 }), false);
    assert.equal(canCreateAccountNow({ registrationOpen: true, userCount: 1 }), true);
  });
});
