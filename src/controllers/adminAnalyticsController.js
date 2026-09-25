import { getChallengeCollection, getSolveCollection } from "../models/challengeModel.js";
import { getContactCollection } from "../models/contactModel.js";
import { getContentCollection } from "../models/contentModel.js";
import {
  getHomeworkCollection,
  getHomeworkSubmissionCollection,
} from "../models/homeworkModel.js";
import { getUserCollection } from "../models/userModel.js";

export const getAdminAnalytics = async (req, res) => {
  try {
    const [
      users,
      challenges,
      solves,
      homeworks,
      homeworkSubmissions,
      announcements,
      blogs,
      contacts,
    ] = await Promise.all([
      getUserCollection(),
      getChallengeCollection(),
      getSolveCollection(),
      getHomeworkCollection(),
      getHomeworkSubmissionCollection(),
      getContentCollection("announcements"),
      getContentCollection("blogs"),
      getContactCollection(),
    ]);

    const [
      totalUsers,
      approvedUsers,
      pendingUsers,
      suspendedUsers,
      roleRows,
      totalChallenges,
      publishedChallenges,
      totalSolves,
      uniqueSolverIds,
      totalHomeworks,
      publishedHomeworks,
      homeworkSubmissionCount,
      announcementCount,
      blogCount,
      unreadContacts,
    ] = await Promise.all([
      users.countDocuments({}),
      users.countDocuments({ approvalStatus: "approved", isActive: { $ne: false } }),
      users.countDocuments({ approvalStatus: "pending" }),
      users.countDocuments({ approvalStatus: "suspended" }),
      users
        .aggregate([
          { $group: { _id: { $ifNull: ["$role", "member"] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      challenges.countDocuments({ archived: { $ne: true } }),
      challenges.countDocuments({ published: true, archived: { $ne: true } }),
      solves.countDocuments({}),
      solves.distinct("uid"),
      homeworks.countDocuments({ archived: { $ne: true } }),
      homeworks.countDocuments({ published: true, archived: { $ne: true } }),
      homeworkSubmissions.countDocuments({}),
      announcements.countDocuments({ published: true }),
      blogs.countDocuments({ published: true }),
      contacts.countDocuments({ status: "new" }),
    ]);

    return res.send({
      generatedAt: new Date().toISOString(),
      users: {
        total: totalUsers,
        approved: approvedUsers,
        pending: pendingUsers,
        suspended: suspendedUsers,
        roles: Object.fromEntries(roleRows.map((row) => [row._id, row.count])),
      },
      ctf: {
        challenges: totalChallenges,
        publishedChallenges,
        solves: totalSolves,
        uniqueSolvers: uniqueSolverIds.length,
      },
      homework: {
        total: totalHomeworks,
        published: publishedHomeworks,
        submissions: homeworkSubmissionCount,
      },
      content: {
        publishedAnnouncements: announcementCount,
        publishedBlogs: blogCount,
      },
      inbox: {
        newMessages: unreadContacts,
      },
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return res.status(500).send({ message: "Failed to load analytics" });
  }
};
