import express from "express";
import {
  createContactMessage,
  listContactMessages,
  updateContactStatus,
} from "../controllers/contactController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.post("/", createContactMessage);

router.get(
  "/admin",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  listContactMessages,
);

router.patch(
  "/admin/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  updateContactStatus,
);

export default router;
