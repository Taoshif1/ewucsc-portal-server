import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateMemberLogin,
  isBootstrapAdminEmail,
  requiresVerifiedFirebaseEmail,
} from "../src/utils/authPolicy.js";

test("configured bootstrap admin is recognized", () => {
  assert.equal(
    isBootstrapAdminEmail("2023-3-60-376@std.ewubd.edu"),
    true,
  );
});

test("bootstrap admin must verify Firebase email when verification is required", () => {
  const user = {
    email: "ewucsc@ewubd.edu",
    role: "admin",
    approvalStatus: "approved",
    emailVerificationRequired: true,
    isActive: true,
  };

  assert.equal(requiresVerifiedFirebaseEmail(user), true);
  assert.deepEqual(
    evaluateMemberLogin({ user, firebaseEmailVerified: false }),
    { allowed: false, status: 403, code: "EMAIL_NOT_VERIFIED" },
  );
  assert.deepEqual(
    evaluateMemberLogin({ user, firebaseEmailVerified: true }),
    { allowed: true, status: 200, code: null },
  );
});

test("normal approved member still requires Firebase email verification", () => {
  const user = {
    email: "2020-1-10-40@std.ewubd.edu",
    role: "member",
    approvalStatus: "approved",
    emailVerificationRequired: true,
    isActive: true,
  };

  assert.equal(requiresVerifiedFirebaseEmail(user), true);
  assert.deepEqual(
    evaluateMemberLogin({ user, firebaseEmailVerified: false }),
    { allowed: false, status: 403, code: "EMAIL_NOT_VERIFIED" },
  );
});

test("pending member remains blocked", () => {
  const user = {
    email: "2020-1-10-40@std.ewubd.edu",
    role: "member",
    approvalStatus: "pending",
    emailVerificationRequired: false,
    isActive: true,
  };

  assert.deepEqual(
    evaluateMemberLogin({ user, firebaseEmailVerified: true }),
    { allowed: false, status: 403, code: "PENDING_APPROVAL" },
  );
});
