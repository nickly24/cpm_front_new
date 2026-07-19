"use client";

import { getToken } from "@/lib/auth/storage";
import { API_BASE_URL } from "@/lib/config";
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getHomeworkRealtimeSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;

  if (!socket || socketToken !== token) {
    socket?.disconnect();
    socketToken = token;
    socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
  }

  return socket;
}

export function disconnectHomeworkRealtime(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

export function realtimeToken(): string | null {
  return socketToken ?? getToken();
}
