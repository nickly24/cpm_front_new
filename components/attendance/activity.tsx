import styles from "./attendance-admin.module.css";
/** Visual spinner, with a useful screen-reader label and no fake percentage. */
export function AttendanceActivity({label,large=false}: {label:string;large?:boolean}) {
 return <span className={large?styles.activityLarge:styles.activity} role="status" aria-label={label}><span className={styles.spinner} aria-hidden="true"/></span>;
}
