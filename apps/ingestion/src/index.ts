import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { trackClickController } from "./controllers/track.js";
import { stripeWebhookController } from "./controllers/revenue/stripe-webhook-controller.js";
import { polarWebhookController } from "./controllers/revenue/polar-webhook-controller.js";
import { dodoWebhookController } from "./controllers/revenue/dodo-webhook-controller.js";
import { lemonsqueezyWebhookController } from "./controllers/revenue/lemonsqueezy-webhook-controller.js";
import { paddleWebhookController } from "./controllers/revenue/paddle-webhook-contoller.js";
import { trackAICrawlerController } from "./controllers/track-ai-bot.js";

const app = express();

// 1. FIRST — handle preflight manually
//
// This service is embedded on arbitrary customer websites (unknown origins
// at any given time), so reflecting the request origin is intentional — but
// no route here relies on cookie-based auth (the tracker snippet sends
// credentials: "omit"; webhook routes are server-to-server and never send
// an Origin header), so Allow-Credentials must stay off. Reflected origin +
// allow-credentials together is the CORS misconfiguration to avoid.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// 2. THEN cors middleware
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    if (!origin) return callback(null, true);
    return callback(null, origin);
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// 3. Stripe/webhook routes must use raw body for signature verification —
// keep these BEFORE express.json() so their bodies stay unparsed
app.post("/api/stripe/webhook/:workspaceId", express.raw({ type: "*/*" }), stripeWebhookController);
app.post("/api/polar/webhook/:workspaceId", express.raw({ type: "*/*" }), polarWebhookController);
app.post("/api/dodo/webhook/:workspaceId", express.raw({ type: "*/*" }), dodoWebhookController);
app.post("/api/lemonsqueezy/webhook/:workspaceId", express.raw({ type: "*/*" }), lemonsqueezyWebhookController);
app.post("/api/paddle/webhook/:workspaceId", express.raw({ type: "*/*" }), paddleWebhookController);

// ai-crawls needs a parsed JSON body (like /api/track), so give it its own
// express.json() middleware instead of relying on the global one below —
// this way it doesn't depend on being declared after the global mount.
app.post("/api/ai-crawls", express.json(), trackAICrawlerController);

// 4. body parser for remaining non-raw-body routes
app.use(express.json());

// 5. routes
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/api/track", trackClickController);

// 6. start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ingestion server running on port ${PORT}`);
});