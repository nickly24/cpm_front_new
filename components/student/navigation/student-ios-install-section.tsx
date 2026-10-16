"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, Copy, Ellipsis, LockKeyhole, PlusSquare, Share, Smartphone } from "lucide-react";
import styles from "./student-ios-install.module.css";

const steps = [
 {title:"Откройте CPM в Safari",text:"На iPhone откройте cpm-lms.ru в Safari. Если сайт открыт внутри Telegram или другого приложения, перейдите в Safari."},
 {title:"Нажмите «Поделиться»",text:"Найдите квадрат со стрелкой вверх. В компактном Safari сначала нажмите «…», затем «Поделиться»."},
 {title:"Выберите «На экран “Домой”»",text:"Прокрутите меню действий вниз и найдите этот пункт."},
 {title:"Добавьте приложение",text:"Оставьте название CPM LMS. Если есть переключатель «Открыть как веб-приложение», включите его и нажмите «Добавить»."},
];

export function StudentIosInstallSection() {
 const [step,setStep]=useState(0);
 return <section className={styles.page} aria-label="Установка на iOS">
  <header className={styles.intro}><span className={styles.eyebrow}><Smartphone size={15}/> CPM НА IPHONE</span><h1>Ваш кабинет.<br/><span>На экране «Домой».</span></h1><p>Установите CPM LMS как веб-приложение: занятия, тесты и задания будут рядом с любимыми приложениями.</p></header>
  <div className={styles.guide}>
   <div className={styles.instructions}><p className={styles.caption}>Четыре шага в Safari <span>Нажмите на шаг, чтобы увидеть пример</span></p><ol className={styles.steps}>{steps.map((item,index)=><li key={item.title}><button type="button" onClick={()=>setStep(index)} aria-current={step===index?"step":undefined}><span className={styles.number}>{index+1}</span><span><strong>{item.title}</strong><span className={styles.description}>{item.text}</span></span><ArrowRight size={18} className={styles.stepArrow}/></button></li>)}</ol><details className={styles.help}><summary>Не вижу «На экран “Домой”»</summary><p>Внизу меню «Поделиться» откройте «Редактировать действия» и добавьте нужный пункт. Расположение кнопок зависит от версии iOS.</p></details><a className={styles.source} href="https://support.apple.com/ru-ru/guide/iphone/iphea86e5236/ios" target="_blank" rel="noopener noreferrer">Инструкция Apple <ArrowRight size={14}/></a></div>
   <div className={styles.demonstration}><div className={styles.activeInstruction} aria-live="polite"><span>ШАГ {step+1} ИЗ 4</span><h2>{steps[step].title}</h2><p>{steps[step].text}</p></div><div className={styles.phone} aria-hidden="true"><div className={styles.status}><span>9:41</span><i/><span>▰</span></div><div className={styles.phoneContent} key={step}><div className={styles.address}><LockKeyhole size={11}/> cpm-lms.ru <Ellipsis size={17}/></div><div className={styles.miniCabinet}><span className={styles.appIcon}><span>CPM</span></span><strong>Добро пожаловать<br/>в CPM LMS 👋</strong><div className={styles.miniGrid}>{["Задания","Тесты","Экзамены","Карточки"].map((label,index)=><span key={label}><i data-tone={index%2}/>{label}</span>)}</div></div>
    {step===0?<div className={styles.safariHint}><Compass size={28}/><span>Откройте сайт<br/><strong>в Safari</strong></span></div>:null}
    {step===1?<div className={styles.shareCallout}><Share size={24}/><strong>Поделиться</strong></div>:null}
    {step===2?<div className={styles.shareSheet}><span className={styles.handle}/><div className={styles.sheetSite}><span className={styles.smallApp}>CPM</span><span>CPM LMS<small>cpm-lms.ru</small></span></div><div className={styles.sheetRow}>Скопировать <Copy size={17}/></div><div className={styles.highlight}>На экран «Домой» <PlusSquare size={21}/></div></div>:null}
    {step===3?<div className={styles.addSheet}><div className={styles.addHeader}><span>Отмена</span><strong>На экран «Домой»</strong><b>Добавить</b></div><span className={styles.appIcon}>CPM</span><div className={styles.nameField}>CPM LMS</div><div className={styles.toggleRow}><span>Открыть как<br/>веб-приложение</span><i><Check size={11}/></i></div></div>:null}
   </div><div className={styles.safariBar}><ArrowLeft size={20}/><ArrowRight size={20}/><span className={step===1?styles.target:undefined}><Share size={22}/></span><PlusSquare size={20}/></div><span className={styles.homeIndicator}/></div><p className={styles.demoCaption}>Пример интерфейса Safari · шаг {step+1} из 4</p><div className={styles.demoControls}><button type="button" aria-label="Предыдущий шаг" disabled={step===0} onClick={()=>setStep(step-1)}><ArrowLeft size={18}/></button><span>{step+1}<span> / 4</span></span><button type="button" aria-label="Следующий шаг" disabled={step===3} onClick={()=>setStep(step+1)}><ArrowRight size={18}/></button></div></div>
  </div><footer className={styles.finish}><span><Check size={19}/></span><p><strong>Готово — ищите значок CPM на iPhone</strong><br/>Открывайте кабинет прямо с экрана «Домой».</p></footer>
 </section>;
}
