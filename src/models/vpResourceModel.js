import { connectDB } from "../config/db.js";

const SEEDED_RESOURCES = [
  {
    title: "Web Security Field Notes",
    description: "Web-security field notes for responsible, authorized practice.",
    category: "Field Notes",
    resourceUrl: "/vp-resources/web-security-field-notes.html",
    icon: "globe",
    sortOrder: 10,
    published: true,
    archived: false,
  },
  {
    title: "Linux & Security Field Guide",
    description: "A detailed Linux and security command/reference guide.",
    category: "Field Guide",
    resourceUrl: "/vp-resources/linux-security-field-guide.html",
    icon: "linux",
    sortOrder: 20,
    published: true,
    archived: false,
  },
  {
    title: "Reverse Engineering Field Notes",
    description: "Reverse-engineering and Linux CTF reference material.",
    category: "Field Notes",
    resourceUrl: "/vp-resources/reverse-engineering-field-notes.html",
    icon: "code",
    sortOrder: 30,
    published: true,
    archived: false,
  },
  {
    title: "EWUCSC Toolkit",
    description: "A categorized directory of cybersecurity tools and official sources.",
    category: "Toolkit",
    resourceUrl: "/vp-resources/ewucsc-toolkit.html",
    icon: "toolbox",
    sortOrder: 40,
    published: true,
    archived: false,
  },
];

let seedPromise;

const ensureSeeded = async (collection) => {
  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await collection.countDocuments({});
      if (count > 0) return;

      const now = new Date();
      await collection.insertMany(
        SEEDED_RESOURCES.map((item) => ({
          ...item,
          seeded: true,
          createdAt: now,
          updatedAt: now,
        })),
      );
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }

  await seedPromise;
};

export const getVpResourceCollection = async () => {
  const db = await connectDB();
  const collection = db.collection("vpResources");

  await Promise.all([
    collection.createIndex({ published: 1, archived: 1, sortOrder: 1 }),
    collection.createIndex({ updatedAt: -1 }),
  ]);

  await ensureSeeded(collection);
  return collection;
};
