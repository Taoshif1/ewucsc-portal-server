import express from "express";
import {
  createUser,
  getDashboardOverview,
  getLeaderboard,
  getProfile,
  listUsers,
  loginUser,
  updateApproval,
  updateRole,
} from "../controllers/userController.js";
import { getAdminAnalytics } from "../controllers/adminAnalyticsController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyFirebase } from "../middleware/verifyFirebase.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.post("/users", verifyFirebase, createUser);
router.post("/login", verifyFirebase, loginUser);

router.get("/profile", verifyJWT, verifyApprovedMember, getProfile);
router.get("/dashboard/overview", verifyJWT, verifyApprovedMember, getDashboardOverview);
router.get("/leaderboard", verifyJWT, verifyApprovedMember, getLeaderboard);

router.get("/admin/analytics", verifyJWT, verifyApprovedMember, allowRoles("admin", "executive"), getAdminAnalytics);
router.get("/admin/users", verifyJWT, verifyAdmin, listUsers);
router.patch("/admin/users/:uid/approval", verifyJWT, verifyAdmin, updateApproval);
router.patch("/admin/users/:uid/role", verifyJWT, verifyAdmin, updateRole);

export default router;
