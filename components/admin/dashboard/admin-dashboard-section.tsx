"use client";

import styles from "@/components/admin/dashboard/admin-dashboard.module.css";
import { useAuth } from "@/contexts/AuthContext";
import { adminNavigation } from "@/lib/navigation/admin";
import {
  ADMIN_READY_SECTIONS,
  ADMIN_SECTION_DESCRIPTIONS,
} from "@/lib/navigation/admin-sections";
import { getSectionHref } from "@/lib/navigation";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

const CARD_ICON_SIZE = 28;

function SectionCardIcon({
  icon: Icon,
  variant,
}: {
  icon: LucideIcon;
  variant: "ready" | "soon";
}) {
  return (
    <Icon
      size={CARD_ICON_SIZE}
      stroke="currentColor"
      fill="none"
      strokeWidth={variant === "ready" ? 2.25 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    />
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Доброе утро";
  }

  if (hour < 18) {
    return "Добрый день";
  }

  return "Добрый вечер";
}

export function AdminDashboardSection() {
  const { user } = useAuth();
  const name = user?.full_name?.trim() || "администратор";

  return (
    <div className={styles.page}>
      <header className={styles.welcome}>
        <h1 className={styles.welcomeTitle}>
          {getGreeting()}, {name}
        </h1>
        <p className={styles.welcomeText}>
          Панель управления CPM. Выберите раздел — готовые открываются сразу,
          остальные появятся по мере разработки.
        </p>
      </header>

      {adminNavigation.groups.map((group) => {
        const items = group.items.filter((item) => item.id !== "dashboard");

        if (items.length === 0) {
          return null;
        }

        return (
          <section key={group.title} className={styles.group}>
            <h2 className={styles.groupTitle}>{group.title}</h2>
            <div className={styles.cardsGrid}>
              {items.map((item) => {
                const ready = ADMIN_READY_SECTIONS.has(item.id);
                const description =
                  ADMIN_SECTION_DESCRIPTIONS[item.id] ??
                  "Раздел в разработке";
                const Icon = item.icon;

                if (ready) {
                  return (
                    <Link
                      key={item.id}
                      href={getSectionHref("admin", item.id)}
                      className={`${styles.card} ${styles.cardReady}`}
                    >
                      <div className={styles.cardTop}>
                        <span className={styles.cardIcon}>
                          <SectionCardIcon icon={Icon} variant="ready" />
                        </span>
                        <ArrowUpRight
                          className={styles.cardArrow}
                          size={18}
                          aria-hidden
                        />
                      </div>
                      <div className={styles.cardBody}>
                        <h3 className={styles.cardTitle}>{item.label}</h3>
                        <p className={styles.cardDesc}>{description}</p>
                      </div>
                    </Link>
                  );
                }

                return (
                  <article
                    key={item.id}
                    className={`${styles.card} ${styles.cardSoon}`}
                    aria-disabled
                  >
                    <div className={styles.cardTop}>
                      <span className={styles.cardIcon}>
                        <SectionCardIcon icon={Icon} variant="soon" />
                      </span>
                      <span className={styles.badgeSoon}>Скоро</span>
                    </div>
                    <div className={styles.cardBody}>
                      <h3 className={styles.cardTitle}>{item.label}</h3>
                      <p className={styles.cardDesc}>{description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
