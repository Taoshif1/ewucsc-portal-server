const PRIVATE_ASSET_RE = /^\/uploads\/private\/[a-f0-9]{24}$/i;

export const normalizeAttachments = (value) => {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const apiPath = String(item.apiPath || "").trim();
    const id = String(item.id || "").trim();

    if (!PRIVATE_ASSET_RE.test(apiPath) || !/^[a-f0-9]{24}$/i.test(id)) {
      return [];
    }

    return [{
      id,
      name: String(item.name || "attachment").trim().slice(0, 180),
      mimeType: String(item.mimeType || "application/octet-stream").trim().slice(0, 120),
      size: Math.max(0, Math.min(Number(item.size || 0), 10 * 1024 * 1024)),
      apiPath,
    }];
  });
};
