import admin from "../config/firebase.js";

export const verifyFirebase = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decoded;
    return next();
  } catch (error) {
    console.error("Firebase token verification failed:", error?.code || error?.message);
    return res.status(401).send({ message: "Invalid Firebase token" });
  }
};
