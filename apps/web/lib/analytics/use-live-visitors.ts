"use client";

/**
 * useLiveVisitors.ts
 *
 * React hook that connects to the WebSocket and returns live visitor data.
 * Automatically reconnects on disconnect with exponential backoff.
 *
 * Usage:
 *   const { count, pages, connected } = useLiveVisitors(workspaceId);
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PageStat {
  page: string;
  count: number;
}

interface LivePoint {
  id: string;
  latitude: number;
  longitude: number;
  value: number;
}

interface LiveState {
  count: number;
  pages: PageStat[];
  points: LivePoint[];
  connected: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000/ws/live";
const LIVE_COUNT_API = "/api/live/count";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1_000;
const POLL_INTERVAL_MS = 10_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLiveVisitors(projectToken: string | null): LiveState {
  const [state, setState] = useState<LiveState>({
    count: 0,
    pages: [],
    points: [],
    connected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmounted = useRef(false);

  const fetchLiveCount = useCallback(async () => {
    if (!projectToken || unmounted.current) return;

    try {
      const response = await fetch(
        `${LIVE_COUNT_API}?projectToken=${encodeURIComponent(projectToken)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) return;

      const payload = await response.json();
      if (!payload?.ok) return;

      setState((prev) => ({
        ...prev,
        count: payload.count ?? 0,
        pages: payload.pages ?? [],
        points: payload.points ?? [],
      }));
    } catch {
      // Ignore transient polling failures; websocket or next poll will recover.
    }
  }, [projectToken]);

  const connect = useCallback(() => {
    if (!projectToken || unmounted.current) return;

    const shouldUseWebSocket = Boolean(process.env.NEXT_PUBLIC_WS_URL);
    if (!shouldUseWebSocket) {
      setState((s) => ({ ...s, connected: false }));
      return;
    }

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect loop
      wsRef.current.close();
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0;
      setState((s) => ({ ...s, connected: true }));

      // Subscribe to this workspace's live feed
      ws.send(JSON.stringify({ type: "subscribe", projectToken }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "live_count") {
          setState({
            count: msg.count ?? 0,
            pages: msg.pages ?? [],
            points: msg.points ?? [],
            connected: true,
          });
        }

        // Respond to server keepalive
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (err) {
        console.error("[useLiveVisitors] Parse error:", err);
      }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setState((s) => ({ ...s, connected: false }));

      // Exponential backoff reconnect
      if (retryCount.current < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount.current);
        retryCount.current++;
        retryTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose which handles reconnect
    };
  }, [projectToken]);

  useEffect(() => {
    unmounted.current = false;
    fetchLiveCount();

    pollTimer.current = setInterval(() => {
      void fetchLiveCount();
    }, POLL_INTERVAL_MS);

    connect();

    return () => {
      unmounted.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect, fetchLiveCount]);

  return state;
}
