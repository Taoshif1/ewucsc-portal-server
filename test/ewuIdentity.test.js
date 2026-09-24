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
