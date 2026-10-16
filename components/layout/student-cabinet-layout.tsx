"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, CalendarCheck2, ClipboardCheck, GraduationCap, Menu, MoreHorizontal, NotebookPen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import styles from "./student-cabinet-layout.module.css";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { StudentDesktopSidebar } from "@/components/student/navigation/student-desktop-sidebar";
import { STUDENT_DESKTOP_BANNERS } from "@/lib/student/section-banners";
import { studentServices } from "@/lib/navigation/student";

const tabs = [
  { id: "homework", label: "Домашние задания", icon: NotebookPen },
  { id: "tests", label: "Тесты", icon: ClipboardCheck },
  { id: "exams", label: "Экзамены", icon: GraduationCap },
  { id: "attendance", label: "Посещаемость", icon: CalendarCheck2 },
  { id: "menu", label: "Меню", icon: Menu },
];
export const studentFirstName = (name?: string) => name?.trim().split(/\s+/)[0] || "Ученик";

export function StudentCabinetLayout({ children }: { children: ReactNode }) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { immersive } = useCabinetChrome();
  const { user } = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();
  const section = pathname.split("/")[3];
  // Fixed test overlays must keep the list geometry and scroll position underneath.
  const testOverlay = immersive && section === "tests";
  const viewportMode = immersive && !testOverlay;
  const auxiliary = ["profile", "performance", "settings"].includes(section);
  const activeIndex = Math.max(0, tabs.findIndex(tab => tab.id === section || tab.id === "menu" && !tabs.some(item => item.id === section)));
  const name = studentFirstName(user?.full_name);
  const trainingDetail=section==="train"&&pathname.split("/").filter(Boolean).length>=5;
  const bannerSection = ["homework","tests","exams","attendance","train"].includes(section) ? section as "homework"|"tests"|"exams"|"attendance"|"train" : null;
  const bannerColors = {homework:"#ea846a",tests:"#eb8871",exams:"#535e95",attendance:"#87bd92",train:"#e2836b"};
  const banner = desktop && !trainingDetail && bannerSection ? STUDENT_DESKTOP_BANNERS[bannerSection] : null;
  const sectionTitle = studentServices.find(item => item.id === section)?.label || "Меню";

  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const meta = existing || document.createElement("meta");
    const previous = meta.content;
    meta.name = "theme-color";
    meta.content = getComputedStyle(document.documentElement).getPropertyValue("--ds-bg").trim() || (theme === "dark" ? "#191919" : "#f5f5f7");
    if (!existing) document.head.append(meta);
    return () => { if (existing) meta.content = previous; else meta.remove(); };
  }, [theme]);

  return <div className={`cabinet-layout ${styles.layout}`} data-immersive={String(viewportMode)} data-section={section} data-training-detail={trainingDetail?"true":undefined}>
    {desktop && !immersive ? <StudentDesktopSidebar section={section} name={name}/> : null}
    <div className="cabinet-main">
      {!viewportMode ? <header className={`${styles.header} ${testOverlay ? styles.overlayHeader : ""} ${banner ? styles.sectionBanner : ""}`} style={banner ? {"--section-art":`url("${banner}")`,"--section-color":bannerSection ? bannerColors[bannerSection] : undefined} as CSSProperties : undefined} aria-hidden={testOverlay || undefined} inert={testOverlay}>
        {banner ? <span className={styles.bannerArt} aria-hidden="true"/> : null}
        {auxiliary ? <Link href="/cabinet/student/menu" className={styles.backLink}><ArrowLeft size={23}/><span>В меню</span></Link>
          : desktop ? section !== "menu" && !trainingDetail ? <h1 className={styles.desktopTitle}>{sectionTitle}</h1> : <span/> : <Link href="/cabinet/student/profile" className={styles.profileLink} aria-label={`Профиль: ${name}`}><span className={styles.avatar} aria-hidden><Image src="/arts/student-avatar-orange.webp" width={76} height={76} alt="" unoptimized /></span><h1 className={styles.sectionTitle}>{sectionTitle}</h1></Link>}
        {section !== "settings" ? <Link href="/cabinet/student/settings" className={styles.iconButton} aria-label="Открыть настройки"><MoreHorizontal size={26}/></Link> : null}
      </header> : null}
      <main className={`cabinet-content ${!viewportMode ? styles.content : ""}`}>{children}</main>
    </div>
    {!immersive && !desktop ? <nav className={styles.dock} aria-label="Основная навигация ученика" style={{ "--active-tab": activeIndex } as CSSProperties}>
      <div className={styles.dockGlass}>
        <span className={styles.selection} aria-hidden/>
        {tabs.map((tab, index) => { const Icon = tab.icon; const active = index === activeIndex; return <Link key={tab.id} href={`/cabinet/student/${tab.id}`} className={`${styles.tab} ${active ? styles.tabActive : ""}`} aria-current={active ? "page" : undefined}><Icon size={24} strokeWidth={active ? 2.3 : 1.8}/><span>{tab.label}</span></Link>; })}
      </div>
    </nav> : null}
  </div>;
}
