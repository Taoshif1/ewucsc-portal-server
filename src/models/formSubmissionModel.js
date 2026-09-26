import { connectDB } from "../config/db.js";

export const getFormSubmissionCollection = async () => {
  const db = await connectDB();
  const collection = db.collection("formSubmissions");
  await collection.createIndex({ formKey: 1, submittedAt: -1 });
  return collection;
};
