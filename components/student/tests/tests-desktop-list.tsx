import { getExternalScore, getTestDirectionLabel, getTestId, getTestTitle, isExternalTest, formatTestPeriod, formatTestDateCompact, formatTestScore } from "@/lib/student/tests-api";
import type { StudentTestItem, TestSession } from "@/lib/student/tests-types";
import { TESTS_STATUS_LABELS } from "@/lib/student/tests-types";
import { TESTS_STATUS_FILTER_OPTIONS } from "./tests-filter-options";
import styles from "../shared/desktop-catalog.module.css";

export function getCatalogTestScore(test:StudentTestItem,session?:TestSession):number|null {
  if(isExternalTest(test))return getExternalScore(test);
  if(test.status!=="completed" || session?.calculationStatus && session.calculationStatus!=="ready")return null;
  return typeof session?.score==="number"&&Number.isFinite(session.score)?session.score:null;
}
export function TestsDesktopList({tests,sessions,onSelect}:{tests:StudentTestItem[];sessions:Map<string,TestSession>;onSelect:(id:string)=>void}) {
  return <div className={styles.testsList}><div className={styles.columns} aria-hidden><span>Тест</span><span>Период и время</span><span>Статус</span><span>Балл</span></div>{tests.map(test=>{
    const id=getTestId(test),external=isExternalTest(test),status=external?"external":test.status;
    const option=TESTS_STATUS_FILTER_OPTIONS.find(item=>item.value===status)!;const Icon=option.icon;
    const score=getCatalogTestScore(test,sessions.get(id));
    return <article className={styles.row} key={id}><button type="button" className={styles.rowButton} aria-label={getTestTitle(test)} onClick={()=>onSelect(id)}>
      <span className={styles.title}><small>{getTestDirectionLabel(test)}</small><strong>{getTestTitle(test)}</strong>{test.canResume?<em>Есть незавершённая попытка</em>:null}</span>
      <span className={styles.meta}>{external?formatTestDateCompact(test.date):formatTestPeriod(test.startDate,test.endDate)}{!external&&test.timeLimitMinutes!=null&&test.timeLimitMinutes>0?<small>{test.timeLimitMinutes} мин</small>:null}</span>
      <span className={styles.status} data-status={status}><span className={styles.statusIcon}><Icon size={16}/></span>{TESTS_STATUS_LABELS[status]}</span>
      <span className={styles.score}>{score!==null?<><strong>{formatTestScore(score)}</strong><small>/ 100</small></>:<span aria-label="Результат пока недоступен">—</span>}</span>
    </button></article>;
  })}</div>;
}
