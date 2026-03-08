import admin from "../config/firebase.js";

export const verifyFirebase = async (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send("Unauthorized");
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decoded;

    next();

  } catch (error) {

    res.status(401).send("Invalid Firebase Token");

  }
};