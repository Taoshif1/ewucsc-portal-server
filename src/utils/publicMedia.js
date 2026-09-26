import { ObjectId } from "mongodb";

const PUBLIC_UPLOAD_PREFIX = "/api/uploads/public/";

export const publicAssetUrl = (assetId) =>
  ObjectId.isValid(assetId) ? PUBLIC_UPLOAD_PREFIX + assetId : "";

export const normalizePublicMediaUrl = (value = "", assetId = "") => {
  const fromId = publicAssetUrl(assetId);
  if (fromId) return fromId;

  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith(PUBLIC_UPLOAD_PREFIX)) return raw;

  if (raw.startsWith("/uploads/public/")) {
    return "/api" + raw;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.pathname.startsWith(PUBLIC_UPLOAD_PREFIX)) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
    if (parsed.pathname.startsWith("/uploads/public/")) {
      return "/api" + parsed.pathname + parsed.search + parsed.hash;
    }

    if (["http:", "https:"].includes(parsed.protocol)) {
      return raw.slice(0, 2000);
    }
  } catch {
    return null;
  }

  return null;
};

export const normalizePublicMediaUrls = (values = [], fallback = "") => {
  const source = Array.isArray(values) ? values : [];
  const normalized = [];

  for (const value of source.slice(0, 10)) {
    const url = normalizePublicMediaUrl(value);
    if (url && !normalized.includes(url)) normalized.push(url);
  }

  if (normalized.length === 0 && fallback) {
    const legacy = normalizePublicMediaUrl(fallback);
    if (legacy) normalized.push(legacy);
  }

  return normalized;
};
