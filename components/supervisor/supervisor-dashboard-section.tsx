"use client";

import dashboardStyles from "@/components/admin/dashboard/admin-dashboard.module.css";
import { useAuth } from "@/contexts/AuthContext";
import { getSectionHref } from "@/lib/navigation";
import { supervisorNavigation } from "@/lib/navigation/supervisor";
import {
  SUPERVISOR_READY_SECTIONS,
  SUPERVISOR_SECTION_DESCRIPTIONS,
} from "@/lib/navigation/supervisor-sections";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

function SectionCardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon
      size={28}
      stroke="currentColor"
      fill="none"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    />
  );
}

export function SupervisorDashboardSection() {
  const { user } = useAuth();
  const name = user?.full_name?.trim() || "супервайзер";

  return (
    <div className={dashboardStyles.page}>
      <header className={dashboardStyles.welcome}>
        <h1 className={dashboardStyles.welcomeTitle}>
          {getGreeting()}, {name}
        </h1>
        <p className={dashboardStyles.welcomeText}>
          Просмотр отчётов и выгрузка в Excel. Редактирование данных недоступно —
          только просмотр по выбранному периоду.
        </p>
      </header>

      {supervisorNavigation.groups.map((group) => {
        const items = group.items.filter((item) => item.id !== "dashboard");
        if (items.length === 0) {
          return null;
        }

        return (
          <section key={group.title} className={dashboardStyles.group}>
            <h2 className={dashboardStyles.groupTitle}>{group.title}</h2>
            <div className={dashboardStyles.cardsGrid}>
              {items.map((item) => {
                const ready = SUPERVISOR_READY_SECTIONS.has(item.id);
                const description =
                  SUPERVISOR_SECTION_DESCRIPTIONS[item.id] ?? "Отчёт";
                const Icon = item.icon;

                if (!ready) {
                  return (
                    <article
                      key={item.id}
                      className={`${dashboardStyles.card} ${dashboardStyles.cardSoon}`}
                      aria-disabled
                    >
                      <div className={dashboardStyles.cardTop}>
                        <span className={dashboardStyles.cardIcon}>
                          <SectionCardIcon icon={Icon} />
                        </span>
                        <span className={dashboardStyles.badgeSoon}>Скоро</span>
                      </div>
                      <div className={dashboardStyles.cardBody}>
                        <h3 className={dashboardStyles.cardTitle}>{item.label}</h3>
                        <p className={dashboardStyles.cardDesc}>{description}</p>
                      </div>
                    </article>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    href={getSectionHref("supervisor", item.id)}
                    className={`${dashboardStyles.card} ${dashboardStyles.cardReady}`}
                  >
                    <div className={dashboardStyles.cardTop}>
                      <span className={dashboardStyles.cardIcon}>
                        <SectionCardIcon icon={Icon} />
                      </span>
                      <ArrowUpRight
                        className={dashboardStyles.cardArrow}
                        size={18}
                        aria-hidden
                      />
                    </div>
                    <div className={dashboardStyles.cardBody}>
                      <h3 className={dashboardStyles.cardTitle}>{item.label}</h3>
                      <p className={dashboardStyles.cardDesc}>{description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
