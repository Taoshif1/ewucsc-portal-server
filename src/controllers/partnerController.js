import { ObjectId } from "mongodb";
import { getPartnersCollection } from "../models/partnerModel.js";

const TYPES = new Set(["sponsor", "club_partner"]);

const serialize = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
};

const normalizeUrl = (value = "") => {
  const url = String(value || "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return url.slice(0, 2000);
  } catch {
    return null;
  }
};

export const listPartners = async (req, res) => {
  try {
    const collection = await getPartnersCollection();
    const rows = await collection
      .find({ published: true, archived: { $ne: true } })
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(200)
      .toArray();

    return res.send({ items: rows.map(serialize) });
  } catch (error) {
    console.error("Partners list error:", error);
    return res.status(500).send({ message: "Failed to load partners" });
  }
};

export const listAllPartners = async (req, res) => {
  try {
    const collection = await getPartnersCollection();
    const rows = await collection
      .find({})
      .sort({ archived: 1, sortOrder: 1, createdAt: -1 })
      .limit(300)
      .toArray();

    return res.send({ items: rows.map(serialize) });
  } catch (error) {
    console.error("Admin partners list error:", error);
    return res.status(500).send({ message: "Failed to load partners" });
  }
};

export const createPartner = async (req, res) => {
  try {
    const {
      name,
      type = "club_partner",
      description = "",
      websiteUrl = "",
      logoUrl = "",
      published = true,
      sortOrder = 0,
    } = req.body;

    if (!String(name || "").trim()) {
      return res.status(400).send({ message: "Partner name is required" });
    }

    if (!TYPES.has(type)) {
      return res.status(400).send({ message: "Invalid partner type" });
    }

    const normalizedWebsite = normalizeUrl(websiteUrl);
    const normalizedLogo = normalizeUrl(logoUrl);

    if (normalizedWebsite === null || normalizedLogo === null) {
      return res.status(400).send({ message: "Website/logo must use a valid http/https URL" });
    }

    const now = new Date();
    const doc = {
      name: String(name).trim().slice(0, 180),
      type,
      description: String(description || "").trim().slice(0, 1200),
      websiteUrl: normalizedWebsite,
      logoUrl: normalizedLogo,
      published: Boolean(published),
      archived: false,
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      createdBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
    };

    const collection = await getPartnersCollection();
    const result = await collection.insertOne(doc);

    return res.status(201).send({
      message: "Partner added",
      item: serialize({ ...doc, _id: result.insertedId }),
    });
  } catch (error) {
    console.error("Create partner error:", error);
    return res.status(500).send({ message: "Failed to create partner" });
  }
};

export const updatePartner = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid partner ID" });
    }

    const collection = await getPartnersCollection();
    const existing = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!existing) {
      return res.status(404).send({ message: "Partner not found" });
    }

    const update = { updatedAt: new Date(), updatedBy: req.user.uid };

    for (const field of [
      "name",
      "type",
      "description",
      "published",
      "archived",
      "sortOrder",
    ]) {
      if (Object.hasOwn(req.body, field)) update[field] = req.body[field];
    }

    if (Object.hasOwn(update, "type") && !TYPES.has(update.type)) {
      return res.status(400).send({ message: "Invalid partner type" });
    }

    if (Object.hasOwn(req.body, "websiteUrl")) {
      const value = normalizeUrl(req.body.websiteUrl);
      if (value === null) {
        return res.status(400).send({ message: "Invalid website URL" });
      }
      update.websiteUrl = value;
    }

    if (Object.hasOwn(req.body, "logoUrl")) {
      const value = normalizeUrl(req.body.logoUrl);
      if (value === null) {
        return res.status(400).send({ message: "Invalid logo URL" });
      }
      update.logoUrl = value;
    }

    if (Object.hasOwn(update, "name")) update.name = String(update.name || "").trim().slice(0, 180);
    if (Object.hasOwn(update, "description")) update.description = String(update.description || "").trim().slice(0, 1200);
    if (Object.hasOwn(update, "published")) update.published = Boolean(update.published);
    if (Object.hasOwn(update, "archived")) update.archived = Boolean(update.archived);
    if (Object.hasOwn(update, "sortOrder")) {
      update.sortOrder = Number.isFinite(Number(update.sortOrder)) ? Number(update.sortOrder) : 0;
    }

    await collection.updateOne({ _id: existing._id }, { $set: update });
    const changed = await collection.findOne({ _id: existing._id });

    return res.send({ message: "Partner updated", item: serialize(changed) });
  } catch (error) {
    console.error("Update partner error:", error);
    return res.status(500).send({ message: "Failed to update partner" });
  }
};

export const deletePartner = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid partner ID" });
    }

    const collection = await getPartnersCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });

    if (!result.deletedCount) {
      return res.status(404).send({ message: "Partner not found" });
    }

    return res.send({ message: "Partner deleted" });
  } catch (error) {
    console.error("Delete partner error:", error);
    return res.status(500).send({ message: "Failed to delete partner" });
  }
};
