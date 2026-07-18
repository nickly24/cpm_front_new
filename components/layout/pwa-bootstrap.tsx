"use client";

import { apiRequest } from "@/lib/api/client";
import { useEffect, useState } from "react";

function bytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function PwaBootstrap() {
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos && !window.matchMedia("(display-mode: standalone)").matches);
    setDismissed(localStorage.getItem("pwa-ios-dismissed") === "1");
    if ("Notification" in window) setPermission(Notification.permission);
    setPushEnabled(localStorage.getItem("cpm-push-enabled") !== "0");
  }, []);

  const enable = async () => {
    const registration = await navigator.serviceWorker.ready;
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return;
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) });
    await apiRequest("/api/homework-chat/push-subscriptions", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
    setPermission(Notification.permission); setPushEnabled(true); localStorage.setItem("cpm-push-enabled", "1");
  };

  const toggle = async () => {
    const enabled = !pushEnabled;
    await apiRequest("/api/homework-chat/push-subscriptions/toggle", { method: "PUT", body: JSON.stringify({ enabled }) });
    setPushEnabled(enabled); localStorage.setItem("cpm-push-enabled", enabled ? "1" : "0");
  };

  return (
    <>
      {ios && !dismissed ? <aside className="pwa-ios-hint">Чтобы получать push на iPhone, нажмите «Поделиться» → «На экран Домой».<button onClick={() => { localStorage.setItem("pwa-ios-dismissed", "1"); setDismissed(true); }}>Понятно</button></aside> : null}
      {!ios && permission === "default" ? <button className="pwa-push-enable" onClick={() => void enable()}>Включить уведомления</button> : null}
      {permission === "granted" ? <button className="pwa-push-enable" onClick={() => void toggle()}>{pushEnabled ? "Отключить push" : "Включить push"}</button> : null}
    </>
  );
}
