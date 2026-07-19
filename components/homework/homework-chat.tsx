"use client";

import { useAuth } from "@/contexts/AuthContext";
import { homeworkChatApi, type ChatMessage } from "@/lib/homework-files/chat-api";
import { getHomeworkRealtimeSocket, realtimeToken } from "@/lib/homework-files/realtime";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./homework-workspace.module.css";
import { ApiError } from "@/lib/api/client";
import { Spinner } from "@/components/ui/spinner";
import { Cloud, Clock3, Info, Paperclip, RefreshCw, Send, UserRound } from "lucide-react";

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
  const draftKey = `homework-chat-draft-${homeworkId}-${studentId ?? "self"}`;
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(draftKey) ?? ""; } catch { return ""; }
  });
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [failedText, setFailedText] = useState<string | null>(null);
  const latest = useRef(0);
  const lastReadSent = useRef(0);
  const typingStopTimer = useRef<number | null>(null);
  const typingHeartbeat = useRef<number | null>(null);
  const typingActive = useRef(false);
  const presenceTimers = useRef(new Map<string, number>());

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    latest.current = Math.max(latest.current, ...incoming.map((item) => item.id));
    setMessages((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      incoming.forEach((item) => byId.set(item.id, item));
      return [...byId.values()].sort((left, right) => left.id - right.id);
    });
  }, []);

  const markRead = useCallback((id: number) => {
    if (!threadId || id <= lastReadSent.current) return;
    lastReadSent.current = id;
    void homeworkChatApi.read(threadId, id).catch(() => {
      lastReadSent.current = Math.min(lastReadSent.current, id - 1);
    });
  }, [threadId]);

  const syncThread = useCallback(async (id: number) => {
    const [history, readState, presence] = await Promise.all([
      homeworkChatApi.history(id, latest.current),
      homeworkChatApi.reads(id),
      homeworkChatApi.presence(id),
    ]);
    merge(history.items);
    setReads(readState.items);
    setTypingRoles([...new Set(presence.items.map((item) => item.actor_role))]);
    if (history.items.length) {
      const newest = Math.max(...history.items.map((item) => item.id));
      if (newest > lastReadSent.current) {
        lastReadSent.current = newest;
        void homeworkChatApi.read(id, newest).catch(() => {
          lastReadSent.current = Math.min(lastReadSent.current, newest - 1);
        });
      }
    }
  }, [merge]);

  useEffect(() => {
    let stopped = false;
    const start=async()=>{
      setLoading(true);setError(null);setMessages([]);setReads([]);setTypingRoles([]);
      latest.current=0;lastReadSent.current=0;
      try{
        const {thread}=await homeworkChatApi.thread(homeworkId,studentId);if(stopped)return;
        const id=thread?.id??null;setThreadId(id);if(id)await syncThread(id);
      }catch(reason){if(!stopped)setError(reason instanceof Error?reason.message:"Чат недоступен");}
      finally{if(!stopped)setLoading(false);}
    };
    void start();
    return () => { stopped=true; };
  }, [homeworkId, studentId, syncThread]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setTimeout(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retryAfter]);

  useEffect(() => {
    if (!threadId) return;
    const socket=getHomeworkRealtimeSocket();const token=realtimeToken();
    if (!socket || !token) return;
    const timers=presenceTimers.current;
    let subscribed=false;
    const subscribe=(recover:boolean)=>{
      socket.emit("thread.subscribe",{thread_id:threadId,token});subscribed=true;
      if (recover) void syncThread(threadId).catch(() => undefined);
    };
    const connected=()=>subscribe(subscribed);
    const created=(payload:{message?:ChatMessage})=>{
      if (!payload.message) { void syncThread(threadId).catch(() => undefined);return; }
      merge([payload.message]);
      if (!(payload.message.sender_role===user?.role && payload.message.sender_id===user?.id)) markRead(payload.message.id);
    };
    const read=(payload:{reader_role:string;reader_id:number;last_message_id:number})=>setReads((current)=>{
      const without=current.filter((item)=>!(item.reader_role===payload.reader_role&&item.reader_id===payload.reader_id));
      return [...without,payload];
    });
    const typing=(payload:{actor_role:string;actor_id:number;active:boolean;expires_in_ms?:number})=>{
      if (payload.actor_role===user?.role&&payload.actor_id===user?.id) return;
      const key=`${payload.actor_role}:${payload.actor_id}`;const old=timers.get(key);if(old)window.clearTimeout(old);
      setTypingRoles((current)=>payload.active?[...new Set([...current,payload.actor_role])]:current.filter((role)=>role!==payload.actor_role));
      if(payload.active){const timer=window.setTimeout(()=>setTypingRoles((current)=>current.filter((role)=>role!==payload.actor_role)),payload.expires_in_ms??4000);timers.set(key,timer);}
      else timers.delete(key);
    };
    if(socket.connected)subscribe(false);else socket.connect();
    socket.on("connect",connected);socket.on("message.created",created);socket.on("message.read",read);socket.on("typing.changed",typing);
    return()=>{
      socket.emit("thread.unsubscribe",{thread_id:threadId});socket.off("connect",connected);socket.off("message.created",created);socket.off("message.read",read);socket.off("typing.changed",typing);
      timers.forEach((timer)=>window.clearTimeout(timer));timers.clear();
    };
  }, [markRead, merge, syncThread, threadId, user?.id, user?.role]);

  const emitTyping = useCallback((active:boolean) => {
    if (!threadId || typingActive.current===active) return;
    const socket=getHomeworkRealtimeSocket();const token=realtimeToken();if(!socket||!token)return;
    typingActive.current=active;socket.emit("typing.set",{thread_id:threadId,token,active});
    if(typingHeartbeat.current){window.clearInterval(typingHeartbeat.current);typingHeartbeat.current=null;}
    if(active)typingHeartbeat.current=window.setInterval(()=>socket.emit("typing.set",{thread_id:threadId,token,active:true}),2500);
  },[threadId]);

  useEffect(()=>()=>{
    emitTyping(false);
    if(typingStopTimer.current)window.clearTimeout(typingStopTimer.current);
    if(typingHeartbeat.current)window.clearInterval(typingHeartbeat.current);
  },[emitTyping]);

  const change = (value: string) => {
    setText(value);
    try { if (value) localStorage.setItem(draftKey, value); else localStorage.removeItem(draftKey); } catch { /* ignore */ }
    if (value) emitTyping(true); else emitTyping(false);
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => emitTyping(false), 1200);
  };

  const send = async (override?: string) => {
    const payload = (override ?? text).trim();
    if (!payload || sending || retryAfter > 0) return;
    setSending(true);
    setError(null);
    try {
      const result = await homeworkChatApi.send(homeworkId, payload, studentId);
      setThreadId(result.thread_id);
      merge([result.message]);
      setFailedText(null);
      if (!override || payload === text.trim()) change("");
    } catch (reason) {
      if (reason instanceof ApiError && reason.retryAfterSeconds) setRetryAfter(reason.retryAfterSeconds);
      setFailedText(payload);
      setError(reason instanceof Error ? reason.message : "Не удалось отправить");
    } finally { setSending(false); }
  };

  const readLabel = (message: ChatMessage) => {
    const readers = reads.filter((item) => item.last_message_id >= message.id && !(item.reader_role === user?.role && item.reader_id === user?.id));
    if (!readers.length) return null;
    const roles = [...new Set(readers.map((item) => item.reader_role === "student" ? "учеником" : item.reader_role === "admin" ? "администратором" : "проктором"))];
    return `Прочитано ${roles.join(" и ")}`;
  };

  const time = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  const roleLabel = (role: string) => role === "student" ? "Ученик" : role === "admin" ? "Администратор" : "Проктор";

  return (
    <section className={styles.chat}>
      <div className={styles.messages}>
        {loading ? <p className={styles.muted}><Spinner size="sm" /> Загружаем сообщения…</p> : messages.length ? messages.map((message) => message.kind === "system" ? (
          <div className={styles.systemMessage} key={message.id}><Info /><div><b>Система</b><span>{events[message.event_code ?? ""] ?? message.event_code}</span></div><time>{time(message.created_at)}</time></div>
        ) : (
          <div className={styles.messageRow} data-own={message.sender_role === user?.role && message.sender_id === user?.id} key={message.id}>
            {message.sender_role !== user?.role || message.sender_id !== user?.id ? <span className={styles.avatar}><UserRound /></span> : null}
            <div className={styles.messageGroup}><b>{roleLabel(message.sender_role)}</b><div className={styles.message}>
              <span>{message.body}</span><div className={styles.messageMeta}><time>{time(message.created_at)}</time>{message.sender_role === user?.role && message.sender_id === user?.id ? <small>{readLabel(message) ? "✓✓" : "✓"}</small> : null}</div>
            </div>{message.sender_role === user?.role && message.sender_id === user?.id && readLabel(message) ? <small className={styles.readLabel}>{readLabel(message)}</small> : null}</div>
          </div>
        )) : <p className={styles.muted}>Сообщений пока нет</p>}
        {failedText ? <div className={styles.failedMessage}><span>{failedText}</span><div><b>Не отправлено</b><button disabled={sending || retryAfter > 0} onClick={() => void send(failedText)}>{sending ? <Spinner size="sm" /> : <RefreshCw />}Повторить</button></div></div> : null}
        {typingRoles.length ? <p className={styles.typing}>{typingRoles.map(roleLabel).join(", ")} печатает… <i>•••</i></p> : null}
      </div>
      <div className={styles.composer}>
        <div className={styles.inputBox}><textarea maxLength={1000} value={text} onChange={(event) => change(event.target.value)} placeholder="Введите сообщение…" /><div><span>{text.length}/1000</span><button type="button" onClick={() => setError("Вложения в чат пока не поддерживаются")} aria-label="Прикрепить файл"><Paperclip /></button></div></div>
        <p className={styles.draftSaved}><Cloud />Черновик сохранён на устройстве</p>
        <div className={styles.composerMeta}>{retryAfter > 0 ? <span className={styles.cooldown}><Clock3 />Следующее сообщение через {String(Math.floor(retryAfter / 60)).padStart(2, "0")}:{String(retryAfter % 60).padStart(2, "0")}</span> : <span />}
          <button disabled={!text.trim() || retryAfter > 0 || sending} onClick={() => void send()}>
          {sending ? <><Spinner size="sm" />Отправляем…</> : retryAfter > 0 ? `Через ${retryAfter}с` : <>Отправить <Send size={17} /></>}
        </button></div>
      </div>
      {error ? <p className={styles.chatError}>{error}</p> : null}
    </section>
  );
}
