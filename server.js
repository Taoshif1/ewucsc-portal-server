import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

import { connectDB } from "./src/config/db.js";
import userRoutes from "./src/routes/userRoutes.js";
import ctfRoutes from "./src/routes/ctfRoutes.js";
import challengeRoutes from "./src/routes/challengeRoutes.js";
import homeworkRoutes from "./src/routes/homeworkRoutes.js";
import contentRoutes from "./src/routes/contentRoutes.js";
import contactRoutes from "./src/routes/contactRoutes.js";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import galleryRoutes from "./src/routes/galleryRoutes.js";
import formRoutes from "./src/routes/formRoutes.js";
import { bootstrapAdminsReady, ensureBootstrapAdminSeeds } from "./src/services/bootstrapAdmins.js";

dotenv.config();

const app = express();

const defaultBrowserOrigins = [
  "https://ewucsc-portal-client.vercel.app",
  "https://ewucsc-portal-client-taoshifs-projects.vercel.app",
  "https://ewucsc-portal-client-git-main-taoshifs-projects.vercel.app",
  "https://ewucsc.org",
  "https://portal.ewucsc.org",
  "https://resources.ewucsc.org",
];

const configuredOrigins = [
  ...defaultBrowserOrigins,
  process.env.CLIENT_URL,
  process.env.LIVE_CLIENT_URL,
  process.env.ALLOWED_ORIGINS,
]
  .filter(Boolean)
  .flatMap((value) => value.split(","))
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

const isLocalOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const isEwucscVercelPreview = (origin) =>
  /^https:\/\/ewucsc-portal-client-[a-z0-9-]+-taoshifs-projects\.vercel\.app$/i.test(
    origin,
  );

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const normalized = origin.replace(/\/$/, "");

      if (
        configuredOrigins.includes(normalized) ||
        isEwucscVercelPreview(normalized) ||
        (process.env.NODE_ENV !== "production" && isLocalOrigin(normalized))
      ) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-File-Name", "X-File-Type"],
  }),
);

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (req, res) => {
  try {
    await connectDB();
    await ensureBootstrapAdminSeeds();
    const adminBootstrapReady = await bootstrapAdminsReady();

    return res.send({
      ok: true,
      service: "ewucsc-portal-server",
      adminBootstrapReady,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).send({ ok: false, service: "ewucsc-portal-server" });
  }
});

app.use("/api", userRoutes);
app.use("/api/ctf", ctfRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/homeworks", homeworkRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/forms", formRoutes);

app.get("/", (req, res) => {
  res.send("EWUCSC Server Running");
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error?.message === "Origin not allowed by CORS") {
    return res.status(403).send({ message: "Origin not allowed" });
  }

  console.error("Unhandled server error:", error);
  return res.status(500).send({ message: "Internal server error" });
});

const PORT = Number(process.env.PORT || 5000);
let server;

const start = async () => {
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`EWUCSC server listening on port ${PORT}`);
  });
};

const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down EWUCSC server.`);
  server?.close(() => process.exit(0));

  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((error) => {
  console.error("EWUCSC server failed to start:", error);
  process.exit(1);
});
