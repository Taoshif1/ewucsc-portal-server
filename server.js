import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

import userRoutes from "./src/routes/userRoutes.js";
import ctfRoutes from "./src/routes/ctfRoutes.js";
import challengeRoutes from "./src/routes/challengeRoutes.js";
import homeworkRoutes from "./src/routes/homeworkRoutes.js";
import contentRoutes from "./src/routes/contentRoutes.js";


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(helmet());

app.use("/api", userRoutes);
app.use("/api/ctf", ctfRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/homeworks", homeworkRoutes);
app.use("/api/content", contentRoutes);

app.get("/", (req, res) => {
  res.send("EWUCSC Server Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});