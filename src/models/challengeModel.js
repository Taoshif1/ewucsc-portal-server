import { connectDB } from "../config/db.js";

export const getChallengeCollection = async () => {
  const db = await connectDB();
  return db.collection("ctfChallenges");
};

export const getSolveCollection = async () => {
  const db = await connectDB();
  const collection = db.collection("ctfSolves");
  await collection.createIndex({ challengeId: 1, uid: 1 }, { unique: true });
  return collection;
};
