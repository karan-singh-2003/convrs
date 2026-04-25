import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { trackClickController } from "./controllers/track";
import { stripeWebhookController } from "./controllers/stripe-webhook-controller";

const app = express();

//  1. FIRST — handle preflight manually
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204); //  MUST stop here
  }

  next();
});

//  2. THEN cors middleware
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    if (!origin) return callback(null, true);
    return callback(null, origin);
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// 3. Stripe webhook route must use raw body for signature verification
app.post(
  "/api/stripe/webhook/:workspaceId",
  express.raw({ type: "*/*" }),
  stripeWebhookController
);

// 4. body parser for non-Stripe routes
app.use(express.json());

//  5. routes
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/api/track", trackClickController);

//  6. start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ingestion server running on port ${PORT}`);
});
