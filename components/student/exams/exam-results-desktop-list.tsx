import type { StudentResult } from "@/lib/exams-v2/types";
import { formatDate, formatScore, typeLabel } from "@/lib/exams-v2/utils";
import styles from "../shared/desktop-catalog.module.css";
export function ExamResultsDesktopList({items,onSelect}:{items:StudentResult[];onSelect:(id:number)=>void}) {
  return <div className={styles.examsList}><div className={styles.columns} aria-hidden><span>Экзамен</span><span>Тип</span><span>Дата</span><span>Баллы</span><span>Оценка</span></div>{items.map(result=>{
    const classic=result.examType==="classic",grade=classic?result.currentAttempt.grade:result.grade;
    const date=result.examDate!==undefined?result.examDate:classic?result.startAt:result.date;
    return <article key={result.examId} className={styles.row}><button type="button" className={styles.rowButton} aria-label={`Открыть результат: ${result.examName||result.directionName}`} onClick={()=>onSelect(result.examId)}>
      <span className={styles.title}><small>{result.directionName}</small><strong>{result.examName||result.directionName}</strong>{classic&&result.hasActiveRetake&&result.retakeStatus!=="completed"?<em>{result.retakeStatus==="in_progress"?"Пересдача в процессе":result.retakeStatus==="pending_ready"?"Пересдача ожидает готовности комиссии":"Пересдача ожидает начала"}</em>:null}{classic&&result.currentAttempt.attemptNo===2?<em>Результат пересдачи</em>:null}{classic&&result.currentAttempt.hasAppeal?<em>После апелляции</em>:null}</span>
      <span className={styles.meta}>{typeLabel(result.examType)}</span><span className={styles.meta}>{formatDate(date)}</span>
      <span className={styles.meta}>{classic?`${formatScore(result.currentAttempt.roundedTotal)} / ${formatScore(result.currentAttempt.maxScore)}`:formatScore(result.points)}</span>
      <span className={styles.score} aria-label={`Оценка ${grade} из 5`}><strong>{grade}</strong><small>/ 5</small></span>
    </button></article>;
  })}</div>;
}
