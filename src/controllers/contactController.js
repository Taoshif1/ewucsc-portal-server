import { ObjectId } from "mongodb";
import { getContactCollection } from "../models/contactModel.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_STATUSES = new Set(["new", "read", "resolved"]);

const serialize = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
};

export const createContactMessage = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const message = String(req.body.message || "").trim();
    const website = String(req.body.website || "").trim();

    // Honeypot field. Bots often fill hidden fields; respond normally without storing.
    if (website) {
      return res.status(202).send({ message: "Message received" });
    }

    if (name.length < 2 || name.length > 100) {
      return res.status(400).send({ message: "Enter a valid full name" });
    }

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return res.status(400).send({ message: "Enter a valid email address" });
    }

    if (message.length < 10 || message.length > 5000) {
      return res.status(400).send({
        message: "Message must be between 10 and 5000 characters",
      });
    }

    const contacts = await getContactCollection();
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const recent = await contacts.findOne({
      email,
      createdAt: { $gte: oneMinuteAgo },
    });

    if (recent) {
      return res.status(429).send({
        message: "Please wait before sending another message",
      });
    }

    const now = new Date();
    const doc = {
      name,
      email,
      message,
      status: "new",
      createdAt: now,
      updatedAt: now,
    };

    const result = await contacts.insertOne(doc);

    return res.status(201).send({
      message: "Your message has been received by EWUCSC",
      inquiry: { id: result.insertedId.toString(), status: doc.status },
    });
  } catch (error) {
    console.error("Contact submission error:", error);
    return res.status(500).send({ message: "Failed to submit contact message" });
  }
};

export const listContactMessages = async (req, res) => {
  try {
    const contacts = await getContactCollection();
    const status = String(req.query.status || "").trim();
    const query = ALLOWED_STATUSES.has(status) ? { status } : {};

    const rows = await contacts
      .find(query)
      .sort({ createdAt: -1 })
      .limit(300)
      .toArray();

    return res.send({ messages: rows.map(serialize) });
  } catch (error) {
    console.error("Contact inbox error:", error);
    return res.status(500).send({ message: "Failed to load contact messages" });
  }
};

export const updateContactStatus = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid contact message ID" });
    }

    const status = String(req.body.status || "").trim();
    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).send({ message: "Invalid contact message status" });
    }

    const contacts = await getContactCollection();
    const updated = await contacts.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
          handledBy: req.user.uid,
        },
      },
      { returnDocument: "after" },
    );

    if (!updated) {
      return res.status(404).send({ message: "Contact message not found" });
    }

    return res.send({
      message: "Contact message status updated",
      inquiry: serialize(updated),
    });
  } catch (error) {
    console.error("Contact status update error:", error);
    return res.status(500).send({ message: "Failed to update contact message" });
  }
};
