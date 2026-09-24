import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const fromEnvironment = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;

  return {
    projectId,
    clientEmail,
    privateKey,
  };
};

const loadCredential = async () => {
  const envCredential = fromEnvironment();

  if (envCredential) {
    return admin.credential.cert(envCredential);
  }

  try {
    const module = await import("../../serviceAccountKey.json", {
      with: { type: "json" },
    });
    return admin.credential.cert(module.default);
  } catch {
    throw new Error(
      "Firebase Admin credentials are missing. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    );
  }
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: await loadCredential(),
  });
}

export default admin;
