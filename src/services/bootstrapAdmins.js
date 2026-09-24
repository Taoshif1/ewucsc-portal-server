import { getUserCollection } from "../models/userModel.js";
import {
  isValidStudentId,
  normalizeStudentId,
  studentIdToEmail,
} from "../utils/ewuIdentity.js";

const REQUIRED_BOOTSTRAP_ADMINS = [
  "2023-3-60-376@std.ewubd.edu",
];

const normalizeEmail = (value = "") =>
  String(value).trim().toLowerCase();

const configuredBootstrapAdmins = () => [
  ...REQUIRED_BOOTSTRAP_ADMINS,
  ...(process.env.BOOTSTRAP_ADMIN_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean),
];

export const getBootstrapAdminEmails = () =>
  new Set(configuredBootstrapAdmins().map(normalizeEmail));

export const studentIdFromEwuEmail = (email = "") => {
  const normalizedEmail = normalizeEmail(email);
  const suffix = "@std.ewubd.edu";

  if (!normalizedEmail.endsWith(suffix)) return null;

  const studentId = normalizeStudentId(
    normalizedEmail.slice(0, -suffix.length),
  );

  return isValidStudentId(studentId) ? studentId : null;
};

export const isBootstrapAdminEmail = (email = "") =>
  getBootstrapAdminEmails().has(normalizeEmail(email));

export const ensureBootstrapAdminSeeds = async () => {
  const users = await getUserCollection();
  const now = new Date();

  for (const email of getBootstrapAdminEmails()) {
    const studentId = studentIdFromEwuEmail(email);
    if (!studentId) continue;

    const existing = await users.findOne({
      $or: [{ email }, { studentId }],
    });

    const baseUpdate = {
      email,
      studentId,
      role: "admin",
      approvalStatus: "approved",
      emailVerificationRequired: false,
      isActive: true,
      updatedAt: now,
      approvedAt: existing?.approvedAt || now,
      approvedBy: existing?.approvedBy || "bootstrap-config",
    };

    if (existing) {
      await users.updateOne(
        { _id: existing._id },
        {
          $set: baseUpdate,
          $setOnInsert: {
            createdAt: now,
          },
        },
      );
      continue;
    }

    await users.insertOne({
      uid: null,
      name: "EWUCSC Admin",
      ...baseUpdate,
      ctfScore: 0,
      solvedChallenges: 0,
      homeworkCompleted: 0,
      createdAt: now,
    });
  }
};

export const provisionFirebaseUser = async (firebaseUser) => {
  const users = await getUserCollection();
  const email = normalizeEmail(firebaseUser?.email);
  const studentId = studentIdFromEwuEmail(email);

  if (!studentId) return null;

  const bootstrapAdmin = isBootstrapAdminEmail(email);
  const now = new Date();

  let user = await users.findOne({ uid: firebaseUser.uid });

  if (!user) {
    user = await users.findOne({
      $or: [{ email }, { studentId }],
    });
  }

  if (user) {
    const update = {
      uid: firebaseUser.uid,
      email,
      studentId,
      updatedAt: now,
    };

    if (bootstrapAdmin) {
      Object.assign(update, {
        role: "admin",
        approvalStatus: "approved",
        isActive: true,
        emailVerificationRequired: false,
        approvedAt: user.approvedAt || now,
        approvedBy: user.approvedBy || "bootstrap-config",
      });
    }

    await users.updateOne({ _id: user._id }, { $set: update });
    return users.findOne({ _id: user._id });
  }

  const newUser = {
    uid: firebaseUser.uid,
    name:
      String(firebaseUser.name || "").trim() ||
      (bootstrapAdmin ? "EWUCSC Admin" : studentId),
    studentId,
    email,
    role: bootstrapAdmin ? "admin" : "member",
    approvalStatus: bootstrapAdmin ? "approved" : "pending",
    emailVerificationRequired: bootstrapAdmin ? false : true,
    ctfScore: 0,
    solvedChallenges: 0,
    homeworkCompleted: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    approvedAt: bootstrapAdmin ? now : null,
    approvedBy: bootstrapAdmin ? "bootstrap-config" : null,
  };

  await users.insertOne(newUser);
  return newUser;
};

export const expectedBootstrapAdminEmailForStudentId = (studentId = "") => {
  const normalized = normalizeStudentId(studentId);
  if (!isValidStudentId(normalized)) return null;

  const email = studentIdToEmail(normalized);
  return isBootstrapAdminEmail(email) ? email : null;
};


export const bootstrapAdminsReady = async () => {
  const users = await getUserCollection();
  const emails = [...getBootstrapAdminEmails()];

  if (emails.length === 0) return true;

  const count = await users.countDocuments({
    email: { $in: emails },
    role: "admin",
    approvalStatus: "approved",
    isActive: { $ne: false },
  });

  return count === emails.length;
};


export const requiresVerifiedFirebaseEmail = (user = {}) =>
  Boolean(user.emailVerificationRequired) &&
  !isBootstrapAdminEmail(user.email);
