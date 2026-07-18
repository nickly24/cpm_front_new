"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/lib/auth/storage";
import { API_BASE_URL } from "@/lib/config";
import { homeworkChatApi, type ChatMessage } from "@/lib/homework-files/chat-api";
import { io } from "socket.io-client";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./homework-workspace.module.css";
import { ApiError } from "@/lib/api/client";

const events: Record<string, string> = {
  "submission.sent": "Работа отправлена",
  "review.claimed": "Работа взята на проверку",
  "review.released": "Работа возвращена в очередь",
  "revision.requested": "Запрошена доработка",
  "submission.graded": "Работа оценена",
};

export function HomeworkChat({ homeworkId, studentId }: { homeworkId: number; studentId?: number }) {
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<{ reader_role: string; reader_id: number; last_message_id: number }[]>([]);
  const [typingRoles, setTypingRoles] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState(0);
  const latest = useRef(0);
  const typingTimer = useRef<number | null>(null);
  const draftKey = `homework-chat-draft-${homeworkId}-${studentId ?? "self"}`;

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    latest.current = Math.max(latest.current, incoming.at(-1)!.id);
    setMessages((current) => {
      const known = new Set(current.map((item) => item.id));
      return [...current, ...incoming.filter((item) => !known.has(item.id))];
    });
  }, []);

  useEffect(() => {
    try { setText(localStorage.getItem(draftKey) ?? ""); } catch { /* storage unavailable */ }
    void homeworkChatApi.thread(homeworkId, studentId)
      .then(({ thread }) => setThreadId(thread?.id ?? null))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Чат недоступен"));
  }, [draftKey, homeworkId, studentId]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setTimeout(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retryAfter]);

  useEffect(() => {
    if (!threadId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const [history, readState, presence] = await Promise.all([
          homeworkChatApi.history(threadId, latest.current),
          homeworkChatApi.reads(threadId),
          homeworkChatApi.presence(threadId),
        ]);
        if (!stopped) {
          merge(history.items);
          setReads(readState.items);
          setTypingRoles([...new Set(presence.items.map((item) => item.actor_role))]);
          if (history.items.length) void homeworkChatApi.read(threadId, history.items.at(-1)!.id);
        }
      } catch { /* realtime reconnect and explicit retry cover transient errors */ }
      if (!stopped) window.setTimeout(poll, 1000);
    };
    void poll();
    return () => { stopped = true; };
  }, [merge, threadId]);

  useEffect(() => {
    if (!threadId) return;
    const token = getToken();
    const socket = io(API_BASE_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socket.emit("thread.subscribe", { thread_id: threadId, token });
    socket.on("message.created", () => {
      void homeworkChatApi.history(threadId, latest.current).then((data) => merge(data.items));
    });
    return () => { socket.disconnect(); };
  }, [merge, threadId]);

  const change = (value: string) => {
    setText(value);
    try { if (value) localStorage.setItem(draftKey, value); else localStorage.removeItem(draftKey); } catch { /* ignore */ }
    if (threadId) {
      void homeworkChatApi.typing(threadId, Boolean(value));
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => void homeworkChatApi.typing(threadId, false), 1200);
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    setError(null);
    try {
      const result = await homeworkChatApi.send(homeworkId, text.trim(), studentId);
      setThreadId(result.thread_id);
      change("");
    } catch (reason) {
      if (reason instanceof ApiError && reason.retryAfterSeconds) setRetryAfter(reason.retryAfterSeconds);
      setError(reason instanceof Error ? reason.message : "Не удалось отправить");
    }
  };

  const readLabel = (message: ChatMessage) => {
    const readers = reads.filter((item) => item.last_message_id >= message.id && item.reader_id !== user?.id);
    if (!readers.length) return null;
    const roles = [...new Set(readers.map((item) => item.reader_role === "student" ? "учеником" : item.reader_role === "admin" ? "администратором" : "проктором"))];
    return `Прочитано ${roles.join(" и ")}`;
  };

  return (
    <section className={styles.chat}>
      <div className={styles.messages}>
        {messages.length ? messages.map((message) => message.kind === "system" ? (
          <p className={styles.systemMessage} key={message.id}>{events[message.event_code ?? ""] ?? message.event_code}</p>
        ) : (
          <div className={styles.message} data-own={message.sender_role === user?.role && message.sender_id === user?.id} key={message.id}>
            <b>{message.sender_role === "student" ? "Ученик" : message.sender_role === "admin" ? "Администратор" : "Проктор"}</b>
            <span>{message.body}</span>
            {message.sender_role === user?.role && message.sender_id === user?.id && readLabel(message) ? <small>{readLabel(message)}</small> : null}
          </div>
        )) : <p className={styles.muted}>Сообщений пока нет</p>}
        {typingRoles.length ? <p className={styles.muted}>{typingRoles.join(", ")} печатает…</p> : null}
      </div>
      <textarea maxLength={1000} value={text} onChange={(event) => change(event.target.value)} placeholder="Напишите сообщение…" />
      <div className={styles.chatFooter}><small>{text.length}/1000</small><button disabled={retryAfter > 0} onClick={() => void send()}>{retryAfter > 0 ? `Повтор через ${retryAfter}с` : "Отправить"}</button></div>
      {error ? <p className={styles.error}>{error}. Сообщение сохранено — нажмите ещё раз.</p> : null}
    </section>
  );
}
