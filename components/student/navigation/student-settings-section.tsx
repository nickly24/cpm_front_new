"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { StudentLogoutButton } from "./student-logout-button";
import styles from "./student-pages.module.css";

export function StudentSettingsSection() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return <div className={styles.settingsPage}>
    <h1 className={styles.pageTitle}>Настройки</h1>
    <section className={styles.appearanceCard} aria-label="Оформление">
      <div className={styles.themePreview} data-theme={theme} aria-hidden>
        <div className={styles.previewTop}><span className={styles.previewAvatar}/><span className={styles.previewLine}/><span className={styles.previewDots}>•••</span></div>
        <div className={styles.previewIcons}><span/><span/><span/></div>
        <div className={styles.previewCard}><span/><span/></div>
        <div className={styles.previewDock}><span/><span/><span/><span/><span/></div>
      </div>
      <div className={styles.themeRow}>
        <span className={styles.themeGlyph} aria-hidden>{dark ? <Moon size={23}/> : <Sun size={23}/>}</span>
        <div className={styles.themeText}><h2>Тёмная тема</h2><span>{dark ? "Включена" : "Выключена"}</span></div>
        <button type="button" role="switch" aria-label="Тёмная тема" aria-checked={dark} className={styles.themeSwitch} onClick={toggleTheme}><Sun size={14}/><Moon size={14}/><span className={styles.switchThumb}/></button>
      </div>
    </section>
    <StudentLogoutButton/>
  </div>;
}
