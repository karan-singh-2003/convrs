import express, { Request, Response } from "express";
import cors from "cors";
import { trackClickController } from "./controllers/track.js";

const app = express();

// CORS - Allow all origins for analytics (customers embed on their sites)
app.use(
  cors({
    origin: true, // Reflect the request origin
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 86400,
  })
);

app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Track endpoint
app.post("/api/track", trackClickController);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ingestion server running on port ${PORT}`));
