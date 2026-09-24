import { connectDB } from "../config/db.js";

export const getContactCollection = async () => {
  const db = await connectDB();
  const collection = db.collection("contactMessages");
  await collection.createIndex({ createdAt: -1 });
  await collection.createIndex({ status: 1, createdAt: -1 });
  return collection;
};
