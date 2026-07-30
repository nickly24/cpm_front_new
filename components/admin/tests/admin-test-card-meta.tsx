"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import { cn } from "@/lib/cn";
import type { AdminTestStatus } from "@/lib/admin/admin-tests-types";
import {
  getAdminTestStatusLabel,
  parseAdminTestDateParts,
} from "@/lib/admin/admin-tests-utils";
import {
  CheckCircle2,
  CircleDot,
  Clock3,
  Hourglass,
  Link2,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STATUS_META: Record<
  AdminTestStatus,
  { icon: LucideIcon; badgeClass: string; iconClass: string }
> = {
  active: {
    icon: CircleDot,
    badgeClass: styles.statusBadgeActive,
    iconClass: styles.statusIconActive,
  },
  upcoming: {
    icon: Hourglass,
    badgeClass: styles.statusBadgeUpcoming,
    iconClass: styles.statusIconUpcoming,
  },
  ended: {
    icon: CheckCircle2,
    badgeClass: styles.statusBadgeEnded,
    iconClass: styles.statusIconEnded,
  },
  external: {
    icon: Link2,
    badgeClass: styles.statusBadgeExternal,
    iconClass: styles.statusIconExternal,
  },
};

export function AdminTestStatusBadge({ status }: { status: AdminTestStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const label = getAdminTestStatusLabel(status);

  return (
    <span
      className={cn(styles.statusBadge, meta.badgeClass)}
      title={label}
      aria-label={label}
      tabIndex={0}
    >
      <span className={cn(styles.statusBadgeIcon, meta.iconClass)}>
        <Icon size={12} aria-hidden />
      </span>
      <span className={styles.statusBadgeLabel} aria-hidden>
        <span className={styles.statusBadgeLabelInner}>{label}</span>
      </span>
    </span>
  );
}

function DateBlock({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const parts = parseAdminTestDateParts(value);

  if (!parts) {
    return (
      <div className={styles.dateBlock}>
        <span className={styles.dateBlockLabel}>{label}</span>
        <span className={styles.dateBlockEmpty}>—</span>
      </div>
    );
  }

  return (
    <div className={styles.dateBlock}>
      <span className={styles.dateBlockLabel}>{label}</span>
      <p className={styles.dateBlockDayline}>
        <span className={styles.dateBlockDay}>{parts.day}</span>{" "}
        <span className={styles.dateBlockMonth}>{parts.month}</span>{" "}
        <span className={styles.dateBlockYear}>{parts.year}</span>
      </p>
      <p className={styles.dateBlockTime}>
        <Clock3 size={12} aria-hidden />
        <span>{parts.time}</span>
      </p>
    </div>
  );
}

export function AdminTestCardSchedule({
  external,
  date,
  startDate,
  endDate,
  timeLimitMinutes,
}: {
  external?: boolean;
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  timeLimitMinutes?: number | null;
}) {
  if (external) {
    return (
      <div className={styles.scheduleStack}>
        <DateBlock label="Дата" value={date} />
      </div>
    );
  }

  return (
    <div className={styles.scheduleStack}>
      {timeLimitMinutes != null ? (
        <p className={styles.limitRow}>
          <Timer size={13} aria-hidden />
          <span>{timeLimitMinutes} мин</span>
        </p>
      ) : null}
      <div className={styles.dateBlocks}>
        <DateBlock label="Начало" value={startDate} />
        <DateBlock label="Конец" value={endDate} />
      </div>
    </div>
  );
}
