"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeftRight, ClipboardCheck, MailPlus, QrCode, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { CabinetContext } from "@/components/layout/cabinet-context";
import { StudentProfileQr } from "@/components/student/performance/student-profile-qr";
import { useBackdropDismiss } from "@/components/ui/dismissible-overlay";
import { studentServices } from "@/lib/navigation/student";
import { StudentNavIcon } from "./student-nav-icon";
import styles from "./student-pages.module.css";

export function StudentMenuSection() {
  const { user } = useAuth();
  const [popup, setPopup] = useState<"qr" | "cabinet" | null>(null);
  const [activeBanner, setActiveBanner] = useState(0);
  const [bannerHovered, setBannerHovered] = useState(false);
  const [bannerHeld, setBannerHeld] = useState(false);
  const carousel = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const popupTitle = useId();
  const dismiss = () => setPopup(null);
  const backdrop = useBackdropDismiss<HTMLDialogElement>(dismiss);
  useEffect(() => {
    if (!popup) return;
    const element = dialog.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal(); closeButton.current?.focus({ preventScroll: true });
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, [popup]);
  const goToBanner = useCallback((index: number) => {
    const element = carousel.current;
    const card = element?.children[index] as HTMLElement | undefined;
    setActiveBanner(index);
    if (element && card) element.scrollTo({ left: card.offsetLeft - (element.children[0] as HTMLElement).offsetLeft, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, []);
  useEffect(() => {
    if (popup || bannerHovered || bannerHeld || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden || carousel.current?.contains(document.activeElement)) return;
      goToBanner((activeBanner + 1) % 3);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeBanner, popup, bannerHovered, bannerHeld, goToBanner]);
  return <section className={styles.menuPage} aria-label="Все разделы ученика">
    <h1 className={styles.welcome}>Добро пожаловать<br/>в CPM LMS <span className={styles.welcomeWave} aria-hidden="true">👋</span></h1>
    <div className={styles.serviceGrid} role="group" aria-label="Разделы">
      {[...studentServices,{id:"install-ios" as const,label:"Установить на iOS"}].map(item => <Link key={item.id} href={`/cabinet/student/${item.id}`} className={styles.service}>
        <span className={styles.serviceArtwork}><StudentNavIcon kind={item.id}/></span><span>{item.label}</span>
      </Link>)}
    </div>
    <div className={styles.quickActions} role="group" aria-label="Быстрые действия">
      <button type="button" className={styles.quickAction} onClick={() => setPopup("qr")}><span className={styles.quickIcon}><QrCode size={27}/></span><span>Показать<br/>QR-код</span></button>
      <Link href="/cabinet/student/tests" className={styles.quickAction}><span className={styles.quickIcon}><ClipboardCheck size={27}/></span><span>Доступные<br/>тесты</span></Link>
      <button type="button" className={styles.quickAction} onClick={() => setPopup("cabinet")}><span className={styles.quickIcon}><ArrowLeftRight size={27}/></span><span>Сменить<br/>кабинет</span></button>
      <Link href="/cabinet/student/zaps?create=1" className={styles.quickAction}><span className={styles.quickIcon}><MailPlus size={27}/></span><span>Запросить<br/>отгул</span></Link>
    </div>
    <div ref={carousel} className={styles.promoCarousel} role="region" aria-label="Новости CPM" tabIndex={0} onPointerEnter={event => { if (event.pointerType === "mouse") setBannerHovered(true); }} onPointerLeave={() => { setBannerHovered(false); setBannerHeld(false); }} onPointerDown={() => setBannerHeld(true)} onPointerUp={() => setBannerHeld(false)} onPointerCancel={() => setBannerHeld(false)} onScroll={event => {
      const element = event.currentTarget;
      const cards = Array.from(element.children) as HTMLElement[];
      const first = cards[0]?.offsetLeft || 0;
      const nearest = cards.reduce((best, card, index) => Math.abs(card.offsetLeft - first - element.scrollLeft) < Math.abs(cards[best].offsetLeft - first - element.scrollLeft) ? index : best, 0);
      setActiveBanner(nearest);
    }}>
      <article className={`${styles.promoCard} ${styles.interfacePromo}`} aria-label="Новый интерфейс CPM">
        <div className={styles.promoCopy}><span className={styles.promoEyebrow}>CPM</span><h2>Учиться стало удобнее</h2><p>Новый интерфейс.<br/>Всё нужное — под рукой.</p></div>
      </article>
      <Link href="/cabinet/student/train" className={`${styles.promoCard} ${styles.cardsPromo}`} aria-label="Карточки снова в деле — перейти к тренировке">
        <div className={styles.promoCopy}><span className={styles.promoEyebrow}>ТРЕНИРОВКИ</span><h2>Карточки<br/>снова в деле</h2><p>Мы всё починили.<br/>Можно снова тренироваться <span aria-hidden>↗</span></p></div>
      </Link>
      <a className={`${styles.promoCard} ${styles.telegramPromo}`} href="https://t.me/+iqniqzLnqK01YThi" target="_blank" rel="noopener noreferrer" aria-label="Наша группа в Telegram — подписывайтесь (откроется в новой вкладке)">
        <div className={styles.promoCopy}><span className={styles.promoEyebrow}>НА СВЯЗИ</span><h2>Наша группа<br/>в Telegram</h2><p>Подписывайтесь <span aria-hidden>↗</span></p></div>
        <svg className={styles.telegramPlane} viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="m14 46 69-28c4-2 7 1 6 6L77 82c-1 5-5 6-9 3L49 71l-10 10c-2 2-4 1-4-2l2-22 38-29-46 24-15-1c-4 0-4-4 0-5Z" fill="currentColor"/></svg>
      </a>
    </div>
    <div className={styles.promoProgress} role="group" aria-label="Выбор баннера">
      {["Новый интерфейс CPM", "Карточки снова в деле", "Наша группа в Telegram"].map((name, index) => <button type="button" key={name} aria-label={`Баннер ${index + 1} из 3: ${name}`} aria-current={activeBanner === index ? "true" : undefined} onClick={() => goToBanner(index)}/>) }
    </div>
    <dialog ref={dialog} className={`${styles.confirmation} ${styles.quickDialog}`} aria-labelledby={popupTitle} onCancel={dismiss} {...backdrop}>
      <div className={styles.quickDialogHeader}><h2 id={popupTitle}>{popup === "cabinet" ? "Сменить кабинет" : "Мой QR-код"}</h2><button ref={closeButton} type="button" onClick={dismiss} aria-label="Закрыть окно"><X size={22}/></button></div>
      {popup === "qr" ? <StudentProfileQr studentId={user?.id}/> : popup === "cabinet" ? <CabinetContext variant="menu" initiallyExpanded/> : null}
    </dialog>
  </section>;
}
