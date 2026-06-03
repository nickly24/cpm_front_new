import type { RatingMetric } from "@/lib/student/performance-types";
import { formatRatingValue } from "@/lib/student/performance-api";
import { BarChart3, GraduationCap, NotebookPen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./performance.module.css";

const ICONS: Record<RatingMetric["id"], LucideIcon> = {
  homework: NotebookPen,
  exams: GraduationCap,
  tests: BarChart3,
};

interface RatingMetricCardProps {
  metric: RatingMetric;
}

export function RatingMetricCard({ metric }: RatingMetricCardProps) {
  const Icon = ICONS[metric.id];
  const hasValue = metric.value != null && !Number.isNaN(Number(metric.value));

  return (
    <article className={styles.statCard}>
      <div className={styles.statMain}>
        <div
          className={styles.statIcon}
          style={{
            background: metric.accentSoft,
            color: metric.accent,
          }}
        >
          <Icon size={22} />
        </div>

        <div className={styles.statInfo}>
          <p className={styles.statLabel}>{metric.label}</p>
          <p className={styles.statDesc}>{metric.description}</p>
        </div>
      </div>

      <p
        className={styles.statValue}
        style={{ color: hasValue ? metric.accent : undefined }}
      >
        {formatRatingValue(metric.value)}
      </p>
    </article>
  );
}
