import express from "express";
import { createUser } from "../controllers/userController.js";
import { verifyFirebase } from "../middleware/verifyFirebase.js";

const router = express.Router();

router.post("/users", verifyFirebase, createUser);

export default router;