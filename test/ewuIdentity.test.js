import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidStudentId,
  normalizeStudentId,
  studentIdToEmail,
} from "../src/utils/ewuIdentity.js";

test("normalizes EWU Student IDs", () => {
  assert.equal(normalizeStudentId(" 2020-1-10-40 "), "2020-1-10-40");
});

test("accepts supported EWU Student ID format", () => {
  assert.equal(isValidStudentId("2020-1-10-40"), true);
  assert.equal(isValidStudentId("2020-1-10-304"), true);
});

test("rejects malformed Student IDs", () => {
  assert.equal(isValidStudentId("2020-01-10-40"), false);
  assert.equal(isValidStudentId("hello"), false);
});

test("derives institutional student email", () => {
  assert.equal(
    studentIdToEmail("2020-1-10-40"),
    "2020-1-10-40@std.ewubd.edu",
  );
});


test("bootstrap admin mapping is stable", async () => {
  process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/unused-test";
  const {
    isBootstrapAdminEmail,
    requiresVerifiedFirebaseEmail,
    studentIdFromEwuEmail,
  } = await import("../src/services/bootstrapAdmins.js");

  assert.equal(
    isBootstrapAdminEmail("2023-3-60-376@std.ewubd.edu"),
    true,
  );
  assert.equal(
    studentIdFromEwuEmail("2023-3-60-376@std.ewubd.edu"),
    "2023-3-60-376",
  );
  assert.equal(
    requiresVerifiedFirebaseEmail({
      email: "2023-3-60-376@std.ewubd.edu",
      emailVerificationRequired: true,
    }),
    false,
  );
  assert.equal(
    requiresVerifiedFirebaseEmail({
      email: "2020-1-10-40@std.ewubd.edu",
      emailVerificationRequired: true,
    }),
    true,
  );
});
