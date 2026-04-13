/**
 * live-websocket.ts
 * 
 * WebSocket server that pushes live visitor counts to dashboard clients.
 * Each dashboard connection subscribes to a specific workspaceId.
 * 
 * Protocol:
 *   Client → Server:  { type: "subscribe", workspaceId: "ws_xxx" }
 *   Server → Client:  { type: "live_count", count: 5, pages: [...] }
 *   Server → Client:  { type: "ping" }  (keepalive every 30s)
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import { getLiveStats } from "./live-visitors";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardClient {
  ws:          WebSocket;
  workspaceId: string | null;
  isAlive:     boolean;
}

// ─── State ────────────────────────────────────────────────────────────────────
// Map of workspaceId → Set of connected dashboard clients
const workspaceClients = new Map<string, Set<DashboardClient>>();
// All clients (for ping/cleanup)
const allClients = new Set<DashboardClient>();

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: "/ws/live", // ws://yourdomain.com/ws/live
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const client: DashboardClient = {
      ws,
      workspaceId: null,
      isAlive: true,
    };
    allClients.add(client);

    // ── Handle messages from dashboard ──────────────────────────────────────
    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "subscribe" && msg.workspaceId) {
          // Unsubscribe from previous workspace if switching
          if (client.workspaceId && client.workspaceId !== msg.workspaceId) {
            const prev = workspaceClients.get(client.workspaceId);
            if (prev) prev.delete(client);
          }

          client.workspaceId = msg.workspaceId;

          // Add to workspace bucket
          if (!workspaceClients.has(msg.workspaceId)) {
            workspaceClients.set(msg.workspaceId, new Set());
          }
          workspaceClients.get(msg.workspaceId)!.add(client);

          // Send current count immediately on subscribe
          const stats = await getLiveStats(msg.workspaceId);
          safeSend(client, {
            type:  "live_count",
            count: stats.count,
            pages: stats.pages,
          });
        }

        if (msg.type === "pong") {
          client.isAlive = true;
        }

      } catch (err) {
        console.error("[WS] Message parse error:", err);
      }
    });

    // ── Cleanup on disconnect ────────────────────────────────────────────────
    ws.on("close", () => {
      allClients.delete(client);
      if (client.workspaceId) {
        const bucket = workspaceClients.get(client.workspaceId);
        if (bucket) {
          bucket.delete(client);
          if (bucket.size === 0) {
            workspaceClients.delete(client.workspaceId);
          }
        }
      }
    });

    ws.on("error", (err) => {
      console.error("[WS] Client error:", err.message);
    });
  });

  // ── Keepalive ping every 30s — kill dead connections ──────────────────────
  const pingInterval = setInterval(() => {
    for (const client of allClients) {
      if (!client.isAlive) {
        client.ws.terminate();
        allClients.delete(client);
        continue;
      }
      client.isAlive = false;
      safeSend(client, { type: "ping" });
    }
  }, 30_000);

  wss.on("close", () => clearInterval(pingInterval));

  console.log("[WS] Live WebSocket server ready at /ws/live");
  return wss;
}

// ─── Broadcast to all dashboard clients watching a workspace ─────────────────
export function broadcastToWorkspace(
  workspaceId: string,
  message: object
): void {
  const clients = workspaceClients.get(workspaceId);
  if (!clients || clients.size === 0) return;

  for (const client of clients) {
    safeSend(client, message);
  }
}

// ─── Safe send — never throws ─────────────────────────────────────────────────
function safeSend(client: DashboardClient, message: object): void {
  if (client.ws.readyState !== WebSocket.OPEN) return;
  try {
    client.ws.send(JSON.stringify(message));
  } catch (err) {
    console.error("[WS] Send error:", err);
  }
}