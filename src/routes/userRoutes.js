import express from "express";
import { createUser, loginUser } from "../controllers/userController.js";
import { verifyFirebase } from "../middleware/verifyFirebase.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();


router.get("/profile", verifyJWT, (req, res) => {
  res.send({
    message: "Protected route working",
    user: req.user
  });
});

router.post("/users", verifyFirebase, createUser);
router.post("/login", verifyFirebase, loginUser);


export default router;