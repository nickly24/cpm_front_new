"use client";

import Image from "next/image";
import { StudentProfileQr } from "./student-profile-qr";
import { CabinetContext } from "@/components/layout/cabinet-context";
import { BFF_DEV } from "@/lib/config";
import styles from "@/components/student/navigation/student-pages.module.css";
import { useAuth } from "@/contexts/AuthContext";

/** Profile entry point is now the avatar; performance remains a compatible legacy URL. */
export function StudentPerformanceSection() {
  const { user } = useAuth();
  return <div className={styles.profilePage}>
    <section className={styles.profileIdentity} aria-label="Мой профиль">
      <div className={styles.profileAvatar} aria-hidden><Image src="/arts/student-avatar-orange.webp" width={164} height={164} alt="" unoptimized /></div>
      <h1 className={styles.profileName}>{user?.full_name || "Ученик"}</h1><p>Студент</p>
    </section>
    <div className={styles.profileDetails}>
      <div><span>Группа</span><strong>{user?.group_id ? `Группа ${user.group_id}` : "Не назначена"}</strong></div>
      <div><span>ID ученика</span><strong>{user?.id ?? "—"}</strong></div>
    </div>
    {BFF_DEV ? <CabinetContext variant="menu"/> : null}
    <section className={styles.qrSection} aria-label="Мой QR-код"><StudentProfileQr studentId={user?.id}/></section>
  </div>;
}
