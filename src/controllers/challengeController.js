import { ObjectId } from "mongodb";
import { getChallengeCollection, getSolveCollection } from "../models/challengeModel.js";
import { getUserCollection } from "../models/userModel.js";
import { hashFlag } from "../utils/flag.js";

const serializeChallenge = (challenge, includeDraftFields = false) => {
  if (!challenge) return null;
  const {
    _id,
    flagHash,
    createdBy,
    updatedBy,
    ...safe
  } = challenge;

  return {
    ...safe,
    id: _id.toString(),
    ...(includeDraftFields ? { createdBy, updatedBy } : {}),
  };
};

export const listChallenges = async (req, res) => {
  try {
    const challenges = await getChallengeCollection();
    const solves = await getSolveCollection();

    const rows = await challenges
      .find({ published: true, archived: { $ne: true } })
      .sort({ sortOrder: 1, createdAt: -1 })
      .toArray();

    const solvedRows = await solves
      .find({ uid: req.user.uid })
      .project({ challengeId: 1 })
      .toArray();

    const solved = new Set(solvedRows.map((row) => row.challengeId.toString()));

    return res.send({
      challenges: rows.map((row) => ({
        ...serializeChallenge(row),
        solved: solved.has(row._id.toString()),
      })),
    });
  } catch (error) {
    console.error("Challenge list error:", error);
    return res.status(500).send({ message: "Failed to load challenges" });
  }
};

export const listAllChallenges = async (req, res) => {
  try {
    const challenges = await getChallengeCollection();
    const rows = await challenges.find({ archived: { $ne: true } }).sort({ createdAt: -1 }).toArray();
    return res.send({ challenges: rows.map((row) => serializeChallenge(row, true)) });
  } catch (error) {
    console.error("Admin challenge list error:", error);
    return res.status(500).send({ message: "Failed to load challenges" });
  }
};

export const createChallenge = async (req, res) => {
  try {
    const challenges = await getChallengeCollection();
    const {
      title,
      description,
      category = "general",
      difficulty = "Easy",
      points = 100,
      flag,
      hint = "",
      published = false,
    } = req.body;

    if (!title?.trim() || !description?.trim() || !flag?.trim()) {
      return res.status(400).send({ message: "Title, description and flag are required" });
    }

    const numericPoints = Number(points);
    if (!Number.isInteger(numericPoints) || numericPoints < 1 || numericPoints > 5000) {
      return res.status(400).send({ message: "Points must be an integer between 1 and 5000" });
    }

    const now = new Date();
    const doc = {
      title: title.trim().slice(0, 160),
      description: description.trim().slice(0, 6000),
      category: String(category).trim().slice(0, 60),
      difficulty: ["Easy", "Medium", "Hard", "Insane"].includes(difficulty) ? difficulty : "Easy",
      points: numericPoints,
      flagHash: hashFlag(flag),
      hint: String(hint || "").trim().slice(0, 1000),
      published: Boolean(published),
      archived: false,
      sortOrder: 0,
      createdBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
    };

    const result = await challenges.insertOne(doc);
    return res.status(201).send({
      message: "Challenge created",
      challenge: serializeChallenge({ ...doc, _id: result.insertedId }, true),
    });
  } catch (error) {
    console.error("Create challenge error:", error);
    return res.status(500).send({ message: "Failed to create challenge" });
  }
};

export const updateChallenge = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid challenge ID" });
    }

    const challenges = await getChallengeCollection();
    const existing = await challenges.findOne({ _id: new ObjectId(req.params.id) });

    if (!existing) {
      return res.status(404).send({ message: "Challenge not found" });
    }

    const allowed = ["title", "description", "category", "difficulty", "points", "hint", "published", "archived", "sortOrder"];
    const update = { updatedAt: new Date(), updatedBy: req.user.uid };

    for (const field of allowed) {
      if (Object.hasOwn(req.body, field)) update[field] = req.body[field];
    }

    if (req.body.flag?.trim()) update.flagHash = hashFlag(req.body.flag);

    if (Object.hasOwn(update, "points")) {
      update.points = Number(update.points);
      if (!Number.isInteger(update.points) || update.points < 1 || update.points > 5000) {
        return res.status(400).send({ message: "Invalid points value" });
      }
    }

    if (update.title) update.title = String(update.title).trim().slice(0, 160);
    if (update.description) update.description = String(update.description).trim().slice(0, 6000);
    if (update.hint) update.hint = String(update.hint).trim().slice(0, 1000);

    await challenges.updateOne({ _id: existing._id }, { $set: update });
    const changed = await challenges.findOne({ _id: existing._id });

    return res.send({ message: "Challenge updated", challenge: serializeChallenge(changed, true) });
  } catch (error) {
    console.error("Update challenge error:", error);
    return res.status(500).send({ message: "Failed to update challenge" });
  }
};

export const submitFlag = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid challenge ID" });
    }

    const submittedFlag = String(req.body.flag || "").trim();
    if (!submittedFlag) {
      return res.status(400).send({ message: "Flag is required" });
    }

    const challenges = await getChallengeCollection();
    const solves = await getSolveCollection();
    const users = await getUserCollection();

    const challengeId = new ObjectId(req.params.id);
    const challenge = await challenges.findOne({
      _id: challengeId,
      published: true,
      archived: { $ne: true },
    });

    if (!challenge) {
      return res.status(404).send({ message: "Challenge not found" });
    }

    if (hashFlag(submittedFlag) !== challenge.flagHash) {
      return res.status(400).send({ message: "Incorrect flag", correct: false });
    }

    const solve = {
      challengeId,
      uid: req.user.uid,
      points: Number(challenge.points || 0),
      solvedAt: new Date(),
    };

    try {
      await solves.insertOne(solve);
    } catch (error) {
      if (error?.code === 11000) {
        return res.send({
          message: "Challenge already solved",
          correct: true,
          alreadySolved: true,
          pointsAwarded: 0,
        });
      }
      throw error;
    }

    await users.updateOne(
      { uid: req.user.uid },
      {
        $inc: {
          ctfScore: Number(challenge.points || 0),
          solvedChallenges: 1,
        },
        $set: { updatedAt: new Date() },
      },
    );

    return res.send({
      message: "Correct flag",
      correct: true,
      alreadySolved: false,
      pointsAwarded: Number(challenge.points || 0),
    });
  } catch (error) {
    console.error("Flag submission error:", error);
    return res.status(500).send({ message: "Failed to submit flag" });
  }
};
