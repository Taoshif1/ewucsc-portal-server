import { connectDB } from "../config/db.js";

export const getPartnersCollection = async () => {
  const db = await connectDB();
  const collection = db.collection("partners");
  await collection.createIndex({ published: 1, archived: 1, sortOrder: 1, createdAt: -1 });
  return collection;
};
