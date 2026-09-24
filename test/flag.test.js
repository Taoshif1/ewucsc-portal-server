import test from "node:test";
import assert from "node:assert/strict";
import { hashFlag, normalizeFlag } from "../src/utils/flag.js";

test("normalizes surrounding whitespace in flags", () => {
  assert.equal(normalizeFlag("  EWUCSC{demo}  "), "EWUCSC{demo}");
});

test("hashing is deterministic after normalization", () => {
  assert.equal(hashFlag("EWUCSC{demo}"), hashFlag("  EWUCSC{demo} "));
});

test("different flags produce different hashes", () => {
  assert.notEqual(hashFlag("EWUCSC{one}"), hashFlag("EWUCSC{two}"));
});

test("raw flags are not returned as hashes", () => {
  assert.notEqual(hashFlag("EWUCSC{demo}"), "EWUCSC{demo}");
  assert.equal(hashFlag("EWUCSC{demo}").length, 64);
});
