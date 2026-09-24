import crypto from "node:crypto";

export const normalizeFlag = (value = "") => String(value).trim();

export const hashFlag = (value = "") =>
  crypto.createHash("sha256").update(normalizeFlag(value)).digest("hex");
