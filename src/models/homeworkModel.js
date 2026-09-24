import { connectDB } from "../config/db.js";

export const getHomeworkCollection = async () => {
  const db = await connectDB();
  return db.collection("homeworks");
};

export const getHomeworkSubmissionCollection = async () => {
  const db = await connectDB();
  const collection = db.collection("homeworkSubmissions");
  await collection.createIndex({ homeworkId: 1, uid: 1 }, { unique: true });
  return collection;
};
