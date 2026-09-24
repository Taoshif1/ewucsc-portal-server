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
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import { verifyFirebase } from "../middleware/verifyFirebase.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.post("/users", verifyFirebase, createUser);
router.post("/login", verifyFirebase, loginUser);

router.get("/profile", verifyJWT, getProfile);
router.get("/dashboard/overview", verifyJWT, getDashboardOverview);
router.get("/leaderboard", verifyJWT, getLeaderboard);

router.get("/admin/users", verifyJWT, verifyAdmin, listUsers);
router.patch("/admin/users/:uid/approval", verifyJWT, verifyAdmin, updateApproval);
router.patch("/admin/users/:uid/role", verifyJWT, verifyAdmin, updateRole);

export default router;
