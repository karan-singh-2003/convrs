import express, { Request, Response } from "express";
import cors from "cors";
import { trackClickController } from "./controllers/track.js";

const app = express();

// ✅ CORS CONFIG (production-ready for analytics SaaS)
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // allow requests with no origin (like curl, server-to-server)
    if (!origin) return callback(null, true);

    // allow all origins (analytics SaaS requirement)
    return callback(null, origin);
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true, // ⭐ VERY IMPORTANT (fixes your error)
  optionsSuccessStatus: 204,
};

// Apply CORS
app.use(cors(corsOptions));

// ✅ Handle preflight requests properly
app.options("/*", cors(corsOptions));

app.use(express.json());

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Track endpoint
app.post("/api/track", trackClickController);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ingestion server running on port ${PORT}`);
});