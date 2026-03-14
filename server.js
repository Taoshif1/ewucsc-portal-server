import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

import userRoutes from "./src/routes/userRoutes.js";


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(helmet());

app.use("/api", userRoutes);

app.get("/", (req, res) => {
  res.send("EWUCSC Server Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});