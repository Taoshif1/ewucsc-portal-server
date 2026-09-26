import { ObjectId } from "mongodb";
import { getVpResourceCollection } from "../models/vpResourceModel.js";

const ICONS = new Set(["globe", "linux", "code", "toolbox", "book", "terminal", "shield"]);

const serialize = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
};

const normalizeResourceUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (raw.startsWith("/")) {
    return raw.slice(0, 2000);
  }

  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol)
      ? raw.slice(0, 2000)
      : null;
  } catch {
    return null;
  }
};

const normalizePayload = (body = {}, existing = null) => {
  const title = String(
    Object.hasOwn(body, "title") ? body.title : existing?.title || "",
  ).trim().slice(0, 180);

  if (!title) return { error: "Title is required" };

  const resourceUrl = normalizeResourceUrl(
    Object.hasOwn(body, "resourceUrl")
      ? body.resourceUrl
      : existing?.resourceUrl || "",
  );

  if (!resourceUrl) {
    return { error: "Resource URL must be a valid http/https URL or internal path" };
  }

  const iconCandidate = String(
    Object.hasOwn(body, "icon") ? body.icon : existing?.icon || "book",
  ).trim();

  const sortOrderValue = Number(
    Object.hasOwn(body, "sortOrder") ? body.sortOrder : existing?.sortOrder || 0,
  );

  return {
    value: {
      title,
      description: String(
        Object.hasOwn(body, "description")
          ? body.description
          : existing?.description || "",
      ).trim().slice(0, 1200),
      category: String(
        Object.hasOwn(body, "category") ? body.category : existing?.category || "Reference",
      ).trim().slice(0, 80),
      resourceUrl,
      icon: ICONS.has(iconCandidate) ? iconCandidate : "book",
      sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
      published: Object.hasOwn(body, "published")
        ? Boolean(body.published)
        : Boolean(existing?.published),
      archived: Object.hasOwn(body, "archived")
        ? Boolean(body.archived)
        : Boolean(existing?.archived),
    },
  };
};

export const listPublishedVpResources = async (req, res) => {
  try {
    const collection = await getVpResourceCollection();
    const rows = await collection
      .find({ published: true, archived: { $ne: true } })
      .sort({ sortOrder: 1, createdAt: 1 })
      .limit(200)
      .toArray();

    return res.send({ items: rows.map(serialize) });
  } catch (error) {
    console.error("VP resources public list error:", error);
    return res.status(500).send({ message: "Failed to load VP resources" });
  }
};

export const listAllVpResources = async (req, res) => {
  try {
    const collection = await getVpResourceCollection();
    const rows = await collection
      .find({})
      .sort({ archived: 1, sortOrder: 1, updatedAt: -1 })
      .limit(300)
      .toArray();

    return res.send({ items: rows.map(serialize) });
  } catch (error) {
    console.error("VP resources admin list error:", error);
    return res.status(500).send({ message: "Failed to load VP resources" });
  }
};

export const createVpResource = async (req, res) => {
  try {
    const normalized = normalizePayload(req.body);
    if (normalized.error) {
      return res.status(400).send({ message: normalized.error });
    }

    const now = new Date();
    const doc = {
      ...normalized.value,
      archived: false,
      createdBy: req.user.uid,
      updatedBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
    };

    const collection = await getVpResourceCollection();
    const result = await collection.insertOne(doc);

    return res.status(201).send({
      message: "VP resource created",
      item: serialize({ ...doc, _id: result.insertedId }),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).send({
        message: "A VP resource with this URL already exists",
      });
    }

    console.error("Create VP resource error:", error);
    return res.status(500).send({ message: "Failed to create VP resource" });
  }
};

export const updateVpResource = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid resource ID" });
    }

    const collection = await getVpResourceCollection();
    const existing = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!existing) {
      return res.status(404).send({ message: "VP resource not found" });
    }

    const normalized = normalizePayload(req.body, existing);
    if (normalized.error) {
      return res.status(400).send({ message: normalized.error });
    }

    const update = {
      ...normalized.value,
      updatedBy: req.user.uid,
      updatedAt: new Date(),
    };

    await collection.updateOne({ _id: existing._id }, { $set: update });
    const changed = await collection.findOne({ _id: existing._id });

    return res.send({
      message: "VP resource updated",
      item: serialize(changed),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).send({
        message: "A VP resource with this URL already exists",
      });
    }

    console.error("Update VP resource error:", error);
    return res.status(500).send({ message: "Failed to update VP resource" });
  }
};

export const deleteVpResource = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid resource ID" });
    }

    const collection = await getVpResourceCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });

    if (!result.deletedCount) {
      return res.status(404).send({ message: "VP resource not found" });
    }

    return res.send({ message: "VP resource deleted" });
  } catch (error) {
    console.error("Delete VP resource error:", error);
    return res.status(500).send({ message: "Failed to delete VP resource" });
  }
};
