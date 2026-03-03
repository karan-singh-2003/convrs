// Simple webhook receiver for testing
// Run with: node test-webhook-receiver.js

const http = require("http");
const crypto = require("crypto");

const PORT = 3001;
const WEBHOOK_SECRET = "your_webhook_secret_here"; // Replace with your actual secret

const server = http.createServer((req, res) => {
  if (req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      console.log("\n=== Webhook Received ===");
      console.log("Headers:", req.headers);
      console.log("\nBody:", body);

      // Verify signature
      const receivedSignature = req.headers["dub-signature"];
      if (receivedSignature && WEBHOOK_SECRET) {
        const expectedSignature = crypto
          .createHmac("sha256", WEBHOOK_SECRET)
          .update(body)
          .digest("hex");

        const isValid = receivedSignature === expectedSignature;
        console.log("\nSignature Valid:", isValid);
      }

      try {
        const payload = JSON.parse(body);
        console.log("\nParsed Payload:");
        console.log("- Event:", payload.event);
        console.log("- Event ID:", payload.id);
        console.log("- Created At:", payload.createdAt);
        console.log("- Data:", JSON.stringify(payload.data, null, 2));
      } catch (e) {
        console.log("Could not parse JSON body");
      }

      // Respond with success
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true }));
    });
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`🎣 Webhook receiver listening on http://localhost:${PORT}`);
  console.log("Use with ngrok: ngrok http", PORT);
});
