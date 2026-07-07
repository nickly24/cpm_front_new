import styles from "@/components/student/section-hero-banner.module.css";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface SectionHeroBannerProps {
  imageSrc: string;
  /** Fallback tint while image loads */
  fallbackColor?: string;
  /** `light` — белый текст на картинке; `dark` — тёмный текст на светлой картинке */
  textTone?: "light" | "dark";
  eyebrow?: string;
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function SectionHeroBanner({
  imageSrc,
  fallbackColor,
  textTone = "light",
  eyebrow,
  title,
  subtitle,
  leading,
  footer,
  className,
}: SectionHeroBannerProps) {
  const isDarkText = textTone === "dark";
  const resolvedFallback =
    fallbackColor ?? (isDarkText ? "#fff3eb" : "#efb09a");

  return (
    <header
      className={cn(
        styles.hero,
        isDarkText && styles.heroDarkText,
        className,
      )}
    >
      <div
        className={styles.heroBg}
        style={{
          backgroundColor: resolvedFallback,
          backgroundImage: imageSrc ? `url("${imageSrc}")` : undefined,
        }}
        aria-hidden
      />
      <div className={styles.heroOverlay} aria-hidden />
      <div className={styles.heroContent}>
        {leading ? <div className={styles.heroLeading}>{leading}</div> : null}
        {eyebrow ? <span className={styles.heroEyebrow}>{eyebrow}</span> : null}
        <h1 className={styles.heroTitle}>{title}</h1>
        {subtitle ? <p className={styles.heroSubtitle}>{subtitle}</p> : null}
        {footer ? <div className={styles.heroFooter}>{footer}</div> : null}
      </div>
    </header>
  );
}
