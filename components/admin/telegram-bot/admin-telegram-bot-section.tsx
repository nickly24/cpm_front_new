"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchTelegramBotSettings,
  fetchTelegramBotStatus,
  restartTelegramBot,
  saveTelegramBotSettings,
  startTelegramBot,
  stopTelegramBot,
  type TelegramBotSettings,
  type TelegramBotStatus,
} from "@/lib/admin/admin-telegram-bot-api";
import { Play, RefreshCw, RotateCcw, Save, Send, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./admin-telegram-bot.module.css";

const DEFAULT_SETTINGS: TelegramBotSettings = {
  bot_token: "",
  token_configured: false,
  autostart: false,
  welcome_text: "Здравствуйте, {full_name}! Я помогу получить доступ к личному кабинету CPM.",
  not_found_text: "Ученик с таким Telegram не найден. Проверьте никнейм у администратора.",
  credentials_text: "Ваши данные для входа в CPM:\n\nЛогин: `{login}`\nПароль: `{password}`",
  button_label: "Узнать логин и пароль",
  updated_at: null,
};

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderTemplate(template: string): string {
  return template
    .replaceAll("{full_name}", "Иванов Иван")
    .replaceAll("{login}", "иванив123")
    .replaceAll("{password}", "A7kP92ms")
    .replaceAll("{class}", "9")
    .replaceAll("{tg_name}", "@ivanov");
}

function statusLabel(status: TelegramBotStatus | null): string {
  if (!status) {
    return "Неизвестно";
  }
  if (status.last_error) {
    return "Ошибка";
  }
  return status.running ? "Запущен" : "Остановлен";
}

export function AdminTelegramBotSection() {
  const [settings, setSettings] = useState<TelegramBotSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<TelegramBotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<"start" | "stop" | "restart" | "refresh" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [nextSettings, nextStatus] = await Promise.all([
      fetchTelegramBotSettings(),
      fetchTelegramBotStatus(),
    ]);
    setSettings(nextSettings);
    setStatus(nextStatus);
  }, []);

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить Telegram-бота");
      } finally {
        setLoading(false);
      }
    });
  }, [load]);

  const preview = useMemo(
    () => renderTemplate(settings.credentials_text || DEFAULT_SETTINGS.credentials_text),
    [settings.credentials_text],
  );

  const updateField = <Key extends keyof TelegramBotSettings>(
    key: Key,
    value: TelegramBotSettings[Key],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleRefresh = async () => {
    setAction("refresh");
    setSuccess(null);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить статус");
    } finally {
      setAction(null);
    }
  };

  const runAction = async (kind: "start" | "stop" | "restart") => {
    setAction(kind);
    setError(null);
    setSuccess(null);
    try {
      const result =
        kind === "start"
          ? await startTelegramBot()
          : kind === "stop"
            ? await stopTelegramBot()
            : await restartTelegramBot();
      if (!result.status) {
        throw new Error(result.error || "Команда не выполнена");
      }
      setSuccess(result.message || "Команда выполнена");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка управления ботом");
    } finally {
      setAction(null);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await saveTelegramBotSettings(settings);
      if (!result.status) {
        throw new Error(result.error || "Не удалось сохранить настройки");
      }
      setSettings(result.settings);
      setSuccess(
        result.restart_required
          ? "Настройки сохранены. Перезапустите бота, чтобы применить новый token."
          : "Настройки сохранены",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Загрузка Telegram-бота…" variant="block" />;
  }

  const running = Boolean(status?.running);
  const hasError = Boolean(status?.last_error);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Telegram-бот</h1>
          <p className={styles.subtitle}>
            Бот связывает Telegram username ученика с профилем CPM и выдает логин с паролем
            по одной кнопке.
          </p>
        </div>
        <div className={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleRefresh()}
            disabled={action !== null || saving}
          >
            <RefreshCw className={styles.buttonIcon} size={16} />
            {action === "refresh" ? "Обновляем…" : "Обновить"}
          </Button>
          <Button
            type="button"
            onClick={() => void runAction("start")}
            disabled={running || action !== null || saving}
          >
            <Play className={styles.buttonIcon} size={16} />
            {action === "start" ? "Запускаем…" : "Start"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void runAction("stop")}
            disabled={!running || action !== null || saving}
          >
            <Square className={styles.buttonIcon} size={16} />
            {action === "stop" ? "Останавливаем…" : "Stop"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void runAction("restart")}
            disabled={action !== null || saving}
          >
            <RotateCcw className={styles.buttonIcon} size={16} />
            {action === "restart" ? "Перезапуск…" : "Restart"}
          </Button>
        </div>
      </header>

      {error ? <div className={styles.alert}>{error}</div> : null}
      {success ? <div className={styles.success}>{success}</div> : null}

      <div className={styles.grid}>
        <Card className={styles.panel}>
          <div className={styles.statusTop}>
            <h2 className={styles.panelTitle}>Сводка</h2>
            <span
              className={`${styles.statusBadge} ${
                hasError
                  ? styles.statusError
                  : running
                    ? styles.statusRunning
                    : styles.statusStopped
              }`}
            >
              <Send size={16} />
              {statusLabel(status)}
            </span>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Token</span>
              <span className={styles.statValue}>
                {status?.token_configured ? "Задан" : "Не задан"}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Autostart</span>
              <span className={styles.statValue}>{status?.autostart ? "Включен" : "Выключен"}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Чаты</span>
              <span className={styles.statValue}>{status?.chats_total ?? 0}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Связанные ученики</span>
              <span className={styles.statValue}>{status?.linked_students ?? 0}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Запущен</span>
              <span className={styles.statValue}>{formatDate(status?.started_at)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Последнее событие</span>
              <span className={styles.statValue}>{formatDate(status?.last_update_at)}</span>
            </div>
          </div>

          {status?.restart_required ? (
            <div className={styles.alert}>Token изменен. Нужен Restart, чтобы бот взял новые настройки.</div>
          ) : null}
          {status?.last_error ? <div className={styles.alert}>{status.last_error}</div> : null}
        </Card>

        <Card className={styles.panel}>
          <h2 className={styles.panelTitle}>Настройки сообщений</h2>
          <form className={styles.form} onSubmit={(event) => void handleSave(event)}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Telegram bot token</span>
              <input
                className={styles.input}
                value={settings.bot_token}
                onChange={(event) => updateField("bot_token", event.target.value)}
                placeholder="123456:ABC..."
              />
            </label>

            <label className={styles.toggleRow}>
              <span className={styles.toggleText}>
                <span className={styles.toggleTitle}>Autostart</span>
                <span className={styles.toggleHint}>Запускать бота при старте Flask-приложения</span>
              </span>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={settings.autostart}
                onChange={(event) => updateField("autostart", event.target.checked)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Приветствие</span>
              <textarea
                className={styles.textarea}
                value={settings.welcome_text}
                onChange={(event) => updateField("welcome_text", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Если ученик не найден</span>
              <textarea
                className={styles.textarea}
                value={settings.not_found_text}
                onChange={(event) => updateField("not_found_text", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Текст с логином и паролем</span>
              <textarea
                className={styles.textarea}
                value={settings.credentials_text}
                onChange={(event) => updateField("credentials_text", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Кнопка</span>
              <input
                className={styles.input}
                value={settings.button_label}
                onChange={(event) => updateField("button_label", event.target.value)}
              />
            </label>

            <div className={styles.preview}>
              <p className={styles.previewText}>{preview}</p>
            </div>

            <div className={styles.actions}>
              <Button type="submit" disabled={saving || action !== null}>
                <Save className={styles.buttonIcon} size={16} />
                {saving ? "Сохраняем…" : "Сохранить настройки"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
