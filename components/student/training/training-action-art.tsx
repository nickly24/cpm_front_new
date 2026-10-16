import { useId } from "react";
import styles from "./training-workspace.module.css";

export function TrainingActionArt({kind}:{kind:"study"|"review"}) {
 const id=useId();
 return <span className={styles.actionArt} data-kind={kind} aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><defs><linearGradient id={id} x1="10" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse"><stop stopColor={kind==="study"?"#ffc16b":"#d2b9ff"}/><stop offset="1" stopColor={kind==="study"?"#ff6542":"#9564e8"}/></linearGradient></defs><rect x="10" y="12" width="34" height="42" rx="8" transform="rotate(-12 10 12)" fill={`url(#${id})`} opacity=".38"/><rect x="20" y="9" width="34" height="44" rx="8" fill={`url(#${id})`}/>{kind==="study"?<path d="M32 23L44 31L32 39V23Z" fill="white"/>:<><path d="M29 23H45M29 31H42M29 39H38" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M43 45L47 49L55 40" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></>}<path d="M9 8V14M6 11H12M53 58V62M51 60H55" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg><i/><i/><i/></span>;
}
