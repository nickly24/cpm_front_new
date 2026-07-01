import { apiRequest } from "@/lib/api/client";

export interface TelegramBotSettings {
  bot_token: string;
  token_configured: boolean;
  autostart: boolean;
  welcome_text: string;
  not_found_text: string;
  credentials_text: string;
  button_label: string;
  updated_at?: string | null;
}

export interface TelegramBotStatus {
  status: boolean;
  running: boolean;
  restart_required: boolean;
  token_configured: boolean;
  autostart: boolean;
  started_at?: string | null;
  last_update_at?: string | null;
  last_error?: string | null;
  chats_total: number;
  linked_students: number;
}

export interface TelegramBotSettingsResponse {
  status: boolean;
  settings: TelegramBotSettings;
  restart_required?: boolean;
  error?: string;
}

export interface TelegramBotActionResponse {
  status: boolean;
  message?: string;
  bot?: TelegramBotStatus;
  error?: string;
}

export async function fetchTelegramBotSettings(): Promise<TelegramBotSettings> {
  const data = await apiRequest<TelegramBotSettingsResponse>("/api/telegram-bot/settings");
  if (!data.status) {
    throw new Error(data.error || "Не удалось загрузить настройки бота");
  }
  return data.settings;
}

export async function saveTelegramBotSettings(
  settings: Partial<TelegramBotSettings>,
): Promise<TelegramBotSettingsResponse> {
  return apiRequest<TelegramBotSettingsResponse>("/api/telegram-bot/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function fetchTelegramBotStatus(): Promise<TelegramBotStatus> {
  return apiRequest<TelegramBotStatus>("/api/telegram-bot/status");
}

export async function startTelegramBot(): Promise<TelegramBotActionResponse> {
  return apiRequest<TelegramBotActionResponse>("/api/telegram-bot/start", {
    method: "POST",
  });
}

export async function stopTelegramBot(): Promise<TelegramBotActionResponse> {
  return apiRequest<TelegramBotActionResponse>("/api/telegram-bot/stop", {
    method: "POST",
  });
}

export async function restartTelegramBot(): Promise<TelegramBotActionResponse> {
  return apiRequest<TelegramBotActionResponse>("/api/telegram-bot/restart", {
    method: "POST",
  });
}
