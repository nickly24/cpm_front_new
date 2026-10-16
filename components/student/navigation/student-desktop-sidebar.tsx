"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { House, Settings2 } from "lucide-react";
import { studentServices } from "@/lib/navigation/student";
import { StudentSidebarIcon } from "./student-sidebar-icon";
import styles from "./student-desktop-sidebar.module.css";

export function StudentDesktopSidebar({section,name}:{section:string;name:string}) {
  const [hovered,setHovered]=useState(false);
  const [focused,setFocused]=useState(false);
  const pinned=section==="menu",expanded=pinned||hovered||focused;
  const close=()=>{setHovered(false);setFocused(false);};
  return <aside className={styles.sidebar} data-expanded={String(expanded)} data-pinned={String(pinned)} aria-label="Боковая панель ученика"
    onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
    onFocusCapture={event=>{if(event.target.matches(":focus-visible"))setFocused(true);}}
    onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false);}}>
    <Link href="/cabinet/student/profile" className={styles.brand} aria-label={`Профиль: ${name}`} onClick={close}>
      <Image src="/arts/student-avatar-orange.webp" width={34} height={34} alt="" unoptimized/><span className={styles.brandText}><strong>{name}</strong><small>Студент</small></span>
    </Link>
    <nav className={styles.navigation} aria-label="Разделы кабинета ученика">
      {[{id:"menu" as const,label:"Главная",icon:House},...studentServices].map(item=>{const Icon=item.icon;return <Link key={item.id} href={`/cabinet/student/${item.id}`} className={styles.item} aria-label={item.label} title={expanded?undefined:item.label} aria-current={section===item.id?"page":undefined} onClick={close}>
        <span className={styles.artwork}><Icon className={styles.restIcon} strokeWidth={1.7} aria-hidden/><span className={styles.colorIcon}><StudentSidebarIcon kind={item.id}/></span></span><span className={styles.label}>{item.label}</span>
      </Link>;})}
    </nav>
    <div className={styles.footer}>
      <Link href="/cabinet/student/settings" className={styles.item} aria-label="Настройки кабинета" title={expanded?undefined:"Настройки"} aria-current={section==="settings"?"page":undefined} onClick={close}><span className={styles.artwork}><Settings2 size={25}/></span><span className={styles.label}>Настройки</span></Link>

    </div>
  </aside>;
}
