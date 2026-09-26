import { connectDB } from "../config/db.js";

export const getFormDefinitionCollection = async () => {
  const db = await connectDB();
  const collection = db.collection("formDefinitions");

  await collection.createIndex({ formKey: 1 }, { unique: true });
  await collection.createIndex({ type: 1, status: 1, openAt: -1, closeAt: 1 });
  await collection.createIndex({ updatedAt: -1 });

  return collection;
};
