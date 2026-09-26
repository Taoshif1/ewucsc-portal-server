import { GridFSBucket, ObjectId } from "mongodb";
import { connectDB } from "../config/db.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PUBLIC_SCOPES = new Set(["content", "gallery", "partner"]);
const PRIVATE_SCOPES = new Set(["challenge", "homework"]);
const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "avif",
  "pdf", "txt", "md", "json", "csv", "zip", "7z", "rar", "pcap", "pcapng",
]);

const safeFileName = (value = "upload") =>
  String(value)
    .replace(/[\\/\0]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "upload";

const fileExtension = (name = "") => {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
};

const isAllowedUpload = (name, mimeType) => {
  if (mimeType === "text/html" || mimeType === "image/svg+xml" || /javascript/i.test(mimeType)) {
    return false;
  }

  if (String(mimeType).startsWith("image/")) return true;
  return ALLOWED_EXTENSIONS.has(fileExtension(name));
};

const getBucket = async () => {
  const db = await connectDB();
  return { db, bucket: new GridFSBucket(db, { bucketName: "media" }) };
};

export const uploadAsset = async (req, res) => {
  try {
    const scope = String(req.params.scope || "").toLowerCase();
    const isPublic = PUBLIC_SCOPES.has(scope);

    if (!isPublic && !PRIVATE_SCOPES.has(scope)) {
      return res.status(400).send({ message: "Unsupported upload scope" });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).send({ message: "Choose a file to upload" });
    }

    if (req.body.length > MAX_UPLOAD_BYTES) {
      return res.status(413).send({ message: "File must be 10 MB or smaller" });
    }

    let originalName = req.get("x-file-name") || "upload";
    try {
      originalName = decodeURIComponent(originalName);
    } catch {
      // Keep the header value if it was not encoded.
    }

    originalName = safeFileName(originalName);
    const mimeType = String(req.get("x-file-type") || "application/octet-stream")
      .trim()
      .slice(0, 120);

    if (!isAllowedUpload(originalName, mimeType)) {
      return res.status(400).send({
        message: "Unsupported file type. Use common images, PDF, text, JSON, CSV, ZIP/7z/RAR or PCAP files.",
      });
    }

    const visibility = isPublic ? "public" : "private";
    const { bucket } = await getBucket();

    const upload = bucket.openUploadStream(originalName, {
      contentType: mimeType,
      metadata: {
        originalName,
        mimeType,
        scope,
        visibility,
        uploadedBy: req.user.uid,
        createdAt: new Date(),
      },
    });

    await new Promise((resolve, reject) => {
      upload.once("error", reject);
      upload.once("finish", resolve);
      upload.end(req.body);
    });

    const id = upload.id.toString();
    const apiPath = `/uploads/${visibility}/${id}`;
    const publicUrl = isPublic ? `/api/uploads/public/${id}` : null;

    return res.status(201).send({
      message: "Upload complete",
      asset: {
        id,
        name: originalName,
        mimeType,
        size: req.body.length,
        scope,
        visibility,
        apiPath,
        url: publicUrl,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).send({ message: "Failed to upload file" });
  }
};

const streamAsset = async (req, res, expectedVisibility) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).send({ message: "Invalid asset ID" });
  }

  const { db, bucket } = await getBucket();
  const id = new ObjectId(req.params.id);
  const file = await db.collection("media.files").findOne({ _id: id });

  if (!file || file.metadata?.visibility !== expectedVisibility) {
    return res.status(404).send({ message: "Asset not found" });
  }

  res.setHeader("Content-Type", file.contentType || file.metadata?.mimeType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(file.metadata?.originalName || file.filename || "asset")}`,
  );
  res.setHeader(
    "Cache-Control",
    expectedVisibility === "public" ? "public, max-age=86400" : "private, no-store",
  );

  if (expectedVisibility === "public") {
    // Public gallery/content/partner media is intentionally embeddable by the
    // club frontend, including during local development on another port.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }

  bucket.openDownloadStream(id)
    .once("error", (error) => {
      console.error("Asset stream error:", error);
      if (!res.headersSent) res.status(404).end();
      else res.destroy(error);
    })
    .pipe(res);
};

export const getPublicAsset = async (req, res) => {
  try {
    return await streamAsset(req, res, "public");
  } catch (error) {
    console.error("Public asset fetch error:", error);
    return res.status(500).send({ message: "Failed to load asset" });
  }
};

export const getPrivateAsset = async (req, res) => {
  try {
    return await streamAsset(req, res, "private");
  } catch (error) {
    console.error("Private asset fetch error:", error);
    return res.status(500).send({ message: "Failed to load asset" });
  }
};

export const deleteAsset = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid asset ID" });
    }

    const { db, bucket } = await getBucket();
    const id = new ObjectId(req.params.id);
    const file = await db.collection("media.files").findOne({ _id: id });

    if (!file) return res.status(404).send({ message: "Asset not found" });

    await bucket.delete(id);
    return res.send({ message: "Asset deleted" });
  } catch (error) {
    console.error("Delete asset error:", error);
    return res.status(500).send({ message: "Failed to delete asset" });
  }
};
