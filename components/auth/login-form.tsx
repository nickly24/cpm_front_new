"use client";

import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/contexts/AuthContext";
import { getCabinetPath } from "@/lib/auth/roles";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export function LoginForm() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(getCabinetPath(user.role));
    }
  }, [loading, router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await login(username, password);

    if (!result.success) {
      setError(result.message || "Ошибка входа");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  if (loading || user) {
    return <LoadingState label="Загрузка…" variant="screen" />;
  }

  return (
    <div className="login-page">
      <section className="login-panel">
        <div className="login-panel-inner">
          <Card>
            <div className="login-card-top">
              <ThemeToggle />
            </div>

            <h2 className="login-card-title">Вход в систему</h2>
            <p className="login-card-subtitle">
              Введите логин и пароль для доступа к кабинету
            </p>

            {error ? (
              <div className="ds-alert" style={{ marginBottom: 16 }}>
                {error}
              </div>
            ) : null}

            <form
              className="login-form"
              onSubmit={(event) => void handleSubmit(event)}
            >
              <Input
                label="Логин"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />

              <Input
                label="Пароль"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Вход..." : "Войти"}
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}
