import { getUserCollection } from "../models/userModel.js";
import { generateToken } from "../utils/generateToken.js";

const STUDENT_ID_PATTERN = /^\d{4}-\d-\d{2}-\d{2,3}$/;
const ALLOWED_ROLES = ["admin", "executive", "sub-executive", "member"];
const ALLOWED_APPROVAL_STATES = ["pending", "approved", "rejected", "suspended"];

const normalizeStudentId = (value = "") => value.trim().toLowerCase();
const studentEmail = (studentId) => `${studentId}@std.ewubd.edu`;

const serializeUser = (user) => {
  if (!user) return null;
  const { _id, ...safeUser } = user;
  return { ...safeUser, id: _id?.toString?.() };
};

const effectiveApprovalStatus = (user) =>
  user.approvalStatus || "approved"; // backwards compatibility for existing accounts

export const createUser = async (req, res) => {
  try {
    const users = await getUserCollection();
    const { uid, name, studentId: rawStudentId } = req.body;
    const studentId = normalizeStudentId(rawStudentId);

    if (!uid || req.firebaseUser.uid !== uid) {
      return res.status(403).send({ message: "Firebase identity mismatch" });
    }

    if (!name?.trim() || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).send({ message: "A valid full name is required" });
    }

    if (!STUDENT_ID_PATTERN.test(studentId)) {
      return res.status(400).send({
        message: "Use a valid EWU Student ID, for example 2020-1-10-40",
      });
    }

    const expectedEmail = studentEmail(studentId);
    const firebaseEmail = req.firebaseUser.email?.trim().toLowerCase();

    if (firebaseEmail !== expectedEmail) {
      return res.status(403).send({
        message: "Your Firebase account must use the EWU student email derived from your Student ID",
      });
    }

    const duplicate = await users.findOne({
      $or: [{ uid }, { studentId }, { email: expectedEmail }],
    });

    if (duplicate) {
      return res.status(409).send({
        message: "An account already exists for this EWU Student ID",
        user: serializeUser(duplicate),
        approvalStatus: effectiveApprovalStatus(duplicate),
      });
    }

    const now = new Date();
    const newUser = {
      uid,
      name: name.trim(),
      studentId,
      email: expectedEmail,
      role: "member",
      approvalStatus: "pending",
      emailVerificationRequired: true,
      ctfScore: 0,
      solvedChallenges: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      approvedAt: null,
      approvedBy: null,
    };

    await users.insertOne(newUser);

    return res.status(201).send({
      message: "Registration submitted. Verify your EWU email and wait for admin approval.",
      user: serializeUser(newUser),
      approvalStatus: "pending",
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).send({ message: "Failed to create account" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const users = await getUserCollection();
    const uid = req.firebaseUser.uid;
    const user = await users.findOne({ uid });

    if (!user) {
      return res.status(404).send({ message: "User not found", code: "USER_NOT_FOUND" });
    }

    if (user.isActive === false) {
      return res.status(403).send({ message: "This account is inactive", code: "ACCOUNT_INACTIVE" });
    }

    if (user.emailVerificationRequired && !req.firebaseUser.email_verified) {
      return res.status(403).send({
        message: "Verify your EWU student email before logging in",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const approvalStatus = effectiveApprovalStatus(user);

    if (approvalStatus === "pending") {
      return res.status(403).send({
        message: "Your EWUCSC membership is waiting for admin approval",
        code: "PENDING_APPROVAL",
      });
    }

    if (approvalStatus === "rejected") {
      return res.status(403).send({
        message: "Your EWUCSC membership request was not approved",
        code: "ACCOUNT_REJECTED",
      });
    }

    if (approvalStatus === "suspended") {
      return res.status(403).send({
        message: "Your EWUCSC account is suspended",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    const token = generateToken({ ...user, approvalStatus: "approved" });

    return res.send({
      user: serializeUser({ ...user, approvalStatus: "approved" }),
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).send({ message: "Failed to log in" });
  }
};

export const getProfile = async (req, res) => {
  try {
    const users = await getUserCollection();
    const user = await users.findOne({ uid: req.user.uid });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    if (effectiveApprovalStatus(user) !== "approved" || user.isActive === false) {
      return res.status(403).send({ message: "Account does not have member access" });
    }

    return res.send({ user: serializeUser({ ...user, approvalStatus: "approved" }) });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return res.status(500).send({ message: "Failed to fetch profile" });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const users = await getUserCollection();
    const rows = await users
      .find({
        isActive: { $ne: false },
        $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
      })
      .project({ name: 1, studentId: 1, role: 1, ctfScore: 1, solvedChallenges: 1 })
      .sort({ ctfScore: -1, solvedChallenges: -1, name: 1 })
      .limit(100)
      .toArray();

    return res.send({
      leaderboard: rows.map((user, index) => ({
        rank: index + 1,
        ...serializeUser(user),
      })),
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return res.status(500).send({ message: "Failed to load leaderboard" });
  }
};

export const getDashboardOverview = async (req, res) => {
  try {
    const users = await getUserCollection();
    const user = await users.findOne({ uid: req.user.uid });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    return res.send({
      member: serializeUser(user),
      stats: {
        ctfScore: Number(user.ctfScore || 0),
        solvedChallenges: Number(user.solvedChallenges || 0),
        homeworkCompleted: Number(user.homeworkCompleted || 0),
      },
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    return res.status(500).send({ message: "Failed to load dashboard" });
  }
};

export const listUsers = async (req, res) => {
  try {
    const users = await getUserCollection();
    const status = req.query.status;
    const query = {};

    if (status && ALLOWED_APPROVAL_STATES.includes(status)) {
      query.approvalStatus = status;
    }

    const rows = await users.find(query).sort({ createdAt: -1 }).limit(500).toArray();

    return res.send({
      users: rows.map((user) => ({
        ...serializeUser(user),
        approvalStatus: effectiveApprovalStatus(user),
      })),
    });
  } catch (error) {
    console.error("Admin user list error:", error);
    return res.status(500).send({ message: "Failed to load users" });
  }
};

export const updateApproval = async (req, res) => {
  try {
    const users = await getUserCollection();
    const { status } = req.body;

    if (!ALLOWED_APPROVAL_STATES.includes(status)) {
      return res.status(400).send({ message: "Invalid approval status" });
    }

    const target = await users.findOne({ uid: req.params.uid });

    if (!target) {
      return res.status(404).send({ message: "User not found" });
    }

    if (target.uid === req.user.uid && status !== "approved") {
      return res.status(400).send({ message: "You cannot remove your own admin access state" });
    }

    const update = {
      approvalStatus: status,
      updatedAt: new Date(),
      approvedAt: status === "approved" ? new Date() : null,
      approvedBy: status === "approved" ? req.user.uid : null,
    };

    await users.updateOne({ uid: target.uid }, { $set: update });
    const updated = await users.findOne({ uid: target.uid });

    return res.send({
      message: `Membership status changed to ${status}`,
      user: serializeUser(updated),
    });
  } catch (error) {
    console.error("Approval update error:", error);
    return res.status(500).send({ message: "Failed to update membership status" });
  }
};

export const updateRole = async (req, res) => {
  try {
    const users = await getUserCollection();
    const { role } = req.body;

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).send({ message: "Invalid role" });
    }

    const target = await users.findOne({ uid: req.params.uid });

    if (!target) {
      return res.status(404).send({ message: "User not found" });
    }

    if (target.uid === req.user.uid && role !== "admin") {
      return res.status(400).send({ message: "You cannot demote your own admin account" });
    }

    await users.updateOne(
      { uid: target.uid },
      { $set: { role, updatedAt: new Date() } },
    );

    const updated = await users.findOne({ uid: target.uid });
    return res.send({ message: "Role updated", user: serializeUser(updated) });
  } catch (error) {
    console.error("Role update error:", error);
    return res.status(500).send({ message: "Failed to update role" });
  }
};
