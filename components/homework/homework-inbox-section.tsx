"use client";

import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/api/client";
import { useEffect, useState } from "react";
import { HomeworkChat } from "./homework-chat";
import styles from "./review-queue.module.css";

interface Thread { id:number; homework_id:number; student_id:number; student_name:string; homework_name:string; unread:number; following:boolean }

export function HomeworkInboxSection() {
  const { user } = useAuth();
  const [items, setItems] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [following, setFollowing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void apiRequest<{ items: Thread[] }>(`/api/homework-chat/inbox?search=${encodeURIComponent(search)}`)
      .then((data) => setItems(data.items)).catch(() => setItems([]));
  }, [search]);

  const follow = async (enabled: boolean) => {
    if (!selected) return;
    await apiRequest(`/api/homework-chat/threads/${selected.id}/follow`, { method: enabled ? "POST" : "DELETE" });
    setFollowing(enabled);
  };

  return (
    <div className={styles.page}>
      <header><div><span>Диалоги</span><h1>Сообщения</h1></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск" /></header>
      <div className={styles.list}>
        {selected ? (
          <>
            <button onClick={() => { setSelected(null); setFollowing(false); }}>← Все диалоги</button>
            <article><div><h2>{selected.student_name}</h2><p>{selected.homework_name}</p></div>{user?.role === "admin" ? <button onClick={() => void follow(!following)}>{following ? "Не отслеживать" : "Подключиться"}</button> : null}</article>
            <HomeworkChat homeworkId={selected.homework_id} studentId={selected.student_id} />
          </>
        ) : items.map((item) => (
          <article key={item.id} onClick={() => { setSelected(item); setFollowing(Boolean(item.following)); }} role="button"><div><h2>{item.student_name}</h2><p>{item.homework_name}</p></div>{item.unread ? <b>{item.unread}</b> : null}</article>
        ))}
      </div>
    </div>
  );
}
