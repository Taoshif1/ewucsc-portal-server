import express from "express";
import {
  createHomework,
  listAllHomeworks,
  listHomeworks,
  submitHomework,
  updateHomework,
  listHomeworkSubmissions,
  reviewHomeworkSubmission,
} from "../controllers/homeworkController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.use(verifyJWT, verifyApprovedMember);

router.get("/", listHomeworks);
router.post("/:id/submit", submitHomework);

router.get("/admin/all", allowRoles("admin", "executive"), listAllHomeworks);
router.post("/admin", allowRoles("admin", "executive"), createHomework);
router.patch("/admin/:id", allowRoles("admin", "executive"), updateHomework);
router.get(
  "/admin/submissions",
  allowRoles("admin", "executive", "sub-executive"),
  listHomeworkSubmissions,
);
router.patch(
  "/admin/submissions/:id",
  allowRoles("admin", "executive", "sub-executive"),
  reviewHomeworkSubmission,
);

export default router;
