import { ObjectId } from "mongodb";
import {
  getHomeworkCollection,
  getHomeworkSubmissionCollection,
} from "../models/homeworkModel.js";

const serialize = (doc) => ({ ...doc, id: doc._id.toString(), _id: undefined });

export const listHomeworks = async (req, res) => {
  try {
    const homeworks = await getHomeworkCollection();
    const submissions = await getHomeworkSubmissionCollection();

    const rows = await homeworks
      .find({ published: true, archived: { $ne: true } })
      .sort({ dueAt: 1, createdAt: -1 })
      .toArray();

    const mine = await submissions.find({ uid: req.user.uid }).toArray();
    const byHomework = new Map(mine.map((item) => [item.homeworkId.toString(), item]));

    return res.send({
      homeworks: rows.map((row) => ({
        ...serialize(row),
        submission: byHomework.has(row._id.toString())
          ? {
              submittedAt: byHomework.get(row._id.toString()).submittedAt,
              status: byHomework.get(row._id.toString()).status,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Homework list error:", error);
    return res.status(500).send({ message: "Failed to load homework" });
  }
};

export const listAllHomeworks = async (req, res) => {
  try {
    const homeworks = await getHomeworkCollection();
    const rows = await homeworks.find({ archived: { $ne: true } }).sort({ createdAt: -1 }).toArray();
    return res.send({ homeworks: rows.map(serialize) });
  } catch (error) {
    return res.status(500).send({ message: "Failed to load homework" });
  }
};

export const createHomework = async (req, res) => {
  try {
    const { title, description, dueAt, published = false } = req.body;

    if (!title?.trim() || !description?.trim()) {
      return res.status(400).send({ message: "Title and description are required" });
    }

    const due = dueAt ? new Date(dueAt) : null;
    if (dueAt && Number.isNaN(due.getTime())) {
      return res.status(400).send({ message: "Invalid due date" });
    }

    const homeworks = await getHomeworkCollection();
    const doc = {
      title: title.trim().slice(0, 160),
      description: description.trim().slice(0, 6000),
      dueAt: due,
      published: Boolean(published),
      archived: false,
      createdBy: req.user.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await homeworks.insertOne(doc);
    return res.status(201).send({ message: "Homework created", homework: serialize({ ...doc, _id: result.insertedId }) });
  } catch (error) {
    console.error("Create homework error:", error);
    return res.status(500).send({ message: "Failed to create homework" });
  }
};

export const updateHomework = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid homework ID" });
    }

    const allowed = ["title", "description", "published", "archived"];
    const update = { updatedAt: new Date() };

    for (const field of allowed) {
      if (Object.hasOwn(req.body, field)) update[field] = req.body[field];
    }

    if (Object.hasOwn(req.body, "dueAt")) {
      update.dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
      if (update.dueAt && Number.isNaN(update.dueAt.getTime())) {
        return res.status(400).send({ message: "Invalid due date" });
      }
    }

    const homeworks = await getHomeworkCollection();
    const result = await homeworks.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: update },
      { returnDocument: "after" },
    );

    if (!result) return res.status(404).send({ message: "Homework not found" });
    return res.send({ message: "Homework updated", homework: serialize(result) });
  } catch (error) {
    console.error("Update homework error:", error);
    return res.status(500).send({ message: "Failed to update homework" });
  }
};

export const submitHomework = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid homework ID" });
    }

    const response = String(req.body.response || "").trim();
    const link = String(req.body.link || "").trim();

    if (!response && !link) {
      return res.status(400).send({ message: "Add a response or submission link" });
    }

    if (link && !/^https:\/\//i.test(link)) {
      return res.status(400).send({ message: "Submission link must use HTTPS" });
    }

    const homeworks = await getHomeworkCollection();
    const homeworkId = new ObjectId(req.params.id);
    const homework = await homeworks.findOne({ _id: homeworkId, published: true, archived: { $ne: true } });

    if (!homework) return res.status(404).send({ message: "Homework not found" });

    const submissions = await getHomeworkSubmissionCollection();
    const now = new Date();

    await submissions.updateOne(
      { homeworkId, uid: req.user.uid },
      {
        $set: {
          response: response.slice(0, 10000),
          link: link.slice(0, 1000),
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    return res.send({ message: "Homework submitted", status: "submitted", submittedAt: now });
  } catch (error) {
    console.error("Homework submission error:", error);
    return res.status(500).send({ message: "Failed to submit homework" });
  }
};


export const listHomeworkSubmissions = async (req, res) => {
  try {
    const submissions = await getHomeworkSubmissionCollection();
    const homeworks = await getHomeworkCollection();
    const rows = await submissions.find({}).sort({ submittedAt: -1 }).limit(500).toArray();

    const homeworkIds = [...new Set(rows.map((row) => row.homeworkId.toString()))].map(
      (id) => new ObjectId(id),
    );
    const homeworkRows = await homeworks
      .find({ _id: { $in: homeworkIds } })
      .project({ title: 1 })
      .toArray();
    const homeworkMap = new Map(homeworkRows.map((row) => [row._id.toString(), row.title]));

    return res.send({
      submissions: rows.map((row) => ({
        id: row._id.toString(),
        homeworkId: row.homeworkId.toString(),
        homeworkTitle: homeworkMap.get(row.homeworkId.toString()) || "Homework",
        uid: row.uid,
        response: row.response || "",
        link: row.link || "",
        status: row.status || "submitted",
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt || null,
        reviewedBy: row.reviewedBy || null,
      })),
    });
  } catch (error) {
    console.error("Homework submissions list error:", error);
    return res.status(500).send({ message: "Failed to load homework submissions" });
  }
};

export const reviewHomeworkSubmission = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid submission ID" });
    }

    const allowed = ["submitted", "reviewed", "accepted", "revision-requested"];
    const status = String(req.body.status || "");

    if (!allowed.includes(status)) {
      return res.status(400).send({ message: "Invalid review status" });
    }

    const submissions = await getHomeworkSubmissionCollection();
    const updated = await submissions.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status,
          reviewedAt: new Date(),
          reviewedBy: req.user.uid,
        },
      },
      { returnDocument: "after" },
    );

    if (!updated) {
      return res.status(404).send({ message: "Submission not found" });
    }

    return res.send({ message: "Submission reviewed", status: updated.status });
  } catch (error) {
    console.error("Homework review error:", error);
    return res.status(500).send({ message: "Failed to review submission" });
  }
};
