import { connectDB } from "../config/db.js";

export const getGalleryCollection = async () => {
  const db = await connectDB();
  const collection = db.collection("gallery");
  await collection.createIndex({ published: 1, archived: 1, eventDate: -1, createdAt: -1 });
  return collection;
};
