import { useCallback, useEffect, useRef, useState } from "react";

export type WebSocketStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export function useParkingWebSocket(onUpdate: (data: any) => void) {
  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const wsUrl =
      process.env.EXPO_PUBLIC_WEBSOCKET_URL ||
      "wss://vmdq0zxc18.execute-api.us-east-1.amazonaws.com/dev";

    if (!wsUrl) {
      setStatus("error");
      return;
    }

    setStatus("connecting");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WS Connected");
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "UPDATE" && msg.data) {
            onUpdate(msg.data);
          }
        } catch (e) {
          console.error("WS Message Parse Error", e);
        }
      };

      ws.onclose = () => {
        console.log("WS Closed, reconnecting...");
        setStatus("disconnected");
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (e) => {
        console.log("WS Error", e);
        setStatus("error");
      };
    } catch (e) {
      console.error("WS Connection Error", e);
      setStatus("error");
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, [onUpdate]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { status };
}
