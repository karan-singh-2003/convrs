import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { trackClickController } from "./controllers/track.js";
import { stripeWebhookController } from "./controllers/revenue/stripe-webhook-controller.js";
import { polarWebhookController } from "./controllers/revenue/polar-webhook-controller.js";
import { dodoWebhookController } from "./controllers/revenue/dodo-webhook-controller.js";
import { lemonsqueezyWebhookController } from "./controllers/revenue/lemonsqueezy-webhook-controller.js";
import { paddleWebhookController } from "./controllers/revenue/paddle-webhook-contoller.js";

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
app.post("/api/stripe/webhook/:workspaceId", express.raw({ type: "*/*" }), stripeWebhookController);
app.post("/api/polar/webhook/:workspaceId", express.raw({ type: "*/*" }), polarWebhookController);
app.post("/api/dodo/webhook/:workspaceId", express.raw({ type: "*/*" }), dodoWebhookController);
app.post("/api/lemonsqueezy/webhook/:workspaceId", express.raw({ type: "*/*" }), lemonsqueezyWebhookController);
app.post("/api/paddle/webhook/:workspaceId", express.raw({ type: "*/*" }), paddleWebhookController);

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
