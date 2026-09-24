import express from "express";
import {
  createChallenge,
  listAllChallenges,
  listChallenges,
  submitFlag,
  updateChallenge,
} from "../controllers/challengeController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.use(verifyJWT, verifyApprovedMember);

router.get("/", listChallenges);
router.post("/:id/submit", submitFlag);

router.get("/admin/all", allowRoles("admin", "executive"), listAllChallenges);
router.post("/admin", allowRoles("admin", "executive"), createChallenge);
router.patch("/admin/:id", allowRoles("admin", "executive"), updateChallenge);

export default router;
