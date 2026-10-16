import { useId } from "react";

export type StudentNavIconKind = "homework" | "tests" | "exams" | "attendance" | "train" | "schedule" | "zaps" | "install-ios";
const palette: Record<StudentNavIconKind, [string, string, string]> = {
  "install-ios": ["#ffc278", "#f17b53", "#e4cbff"],
  homework: ["#b29bff", "#7453e6", "#ffc399"],
  tests: ["#ffac7b", "#f16b53", "#ffe8ae"],
  exams: ["#a08aff", "#6751d6", "#ffbf8f"],
  attendance: ["#ffbe80", "#f38658", "#fff0bc"],
  train: ["#c49aff", "#9160e9", "#ffd9a3"],
  schedule: ["#a9a1ff", "#7a6ce5", "#ffd1a8"],
  zaps: ["#ffb99d", "#ee806e", "#e1ccff"],
};

/** Original vector artwork, sized for the student's app launcher. */
export function StudentNavIcon({ kind }: { kind: StudentNavIconKind }) {
  const id = useId().replaceAll(":", "");
  const [top, bottom, accent] = palette[kind];
  return <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-base`} x1="15" y1="4" x2="73" y2="86" gradientUnits="userSpaceOnUse"><stop stopColor={top}/><stop offset="1" stopColor={bottom}/></linearGradient>
      <linearGradient id={`${id}-paper`} x1="23" y1="17" x2="66" y2="73" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset="1" stopColor="#f1eaff"/></linearGradient>
      <clipPath id={`${id}-clip`}><rect x="2" y="2" width="84" height="84" rx="25"/></clipPath>
      <filter id={`${id}-shadow`} x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dy="3" stdDeviation="2" floodColor={bottom} floodOpacity=".25"/></filter>
    </defs>
    <g clipPath={`url(#${id}-clip)`}>
      <rect x="2" y="2" width="84" height="84" rx="25" fill={`url(#${id}-base)`}/>
      <path d="M-9 61C16 24 37 77 61 51C80 31 94 39 101 49V99H-9Z" fill={accent} opacity=".28"/>
      <circle cx="75" cy="10" r="32" fill="white" opacity=".09"/>
      <g filter={`url(#${id}-shadow)`}>
        {kind === "install-ios" ? <><rect x="27" y="13" width="35" height="62" rx="10" fill={`url(#${id}-paper)`}/><rect x="34" y="17" width="21" height="4" rx="2" fill="#d7c6f1"/><rect x="33" y="28" width="23" height="25" rx="7" fill="#ffad76"/><path d="M44 32V47M38 41L44 47L50 41" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M39 67H50" stroke="#b99adc" strokeWidth="3" strokeLinecap="round"/></> : null}
        {kind === "homework" ? <>
          <path d="M26 19H54L65 30V66A5 5 0 0 1 60 71H26A5 5 0 0 1 21 66V24A5 5 0 0 1 26 19Z" fill={`url(#${id}-paper)`}/><path d="M53 19V28A3 3 0 0 0 56 31H65" fill="#d5c7ff"/>
          <path d="M31 34H43M31 43H48M31 52H43" stroke="#a28be5" strokeWidth="4" strokeLinecap="round"/>
          <g transform="rotate(34 60 50)"><rect x="55" y="32" width="12" height="32" rx="3" fill="#ffad76"/><path d="M55 61H67L61 72Z" fill="#ffdbb1"/><path d="M59 68H63L61 72Z" fill="#7254a5"/><path d="M59 36V59" stroke="#fff0d7" strokeWidth="3" strokeLinecap="round"/></g>
        </> : null}
        {kind === "tests" ? <>
          <rect x="23" y="23" width="43" height="49" rx="8" transform="rotate(7 23 23)" fill="#ffd19d"/>
          <rect x="22" y="17" width="43" height="51" rx="8" fill={`url(#${id}-paper)`}/>
          <rect x="34" y="14" width="20" height="10" rx="5" fill="#a382e7"/>
          <path d="M31 35L34 38L40 32M31 50L34 53L40 47" stroke="#a382e7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M47 36H56M47 51H56" stroke="#d0b9ef" strokeWidth="4" strokeLinecap="round"/>
        </> : null}
        {kind === "exams" ? <>
          <path d="M25 40V55C25 62 35 68 44 68C53 68 63 62 63 55V40" fill="#ffe0b0"/>
          <path d="M12 33L44 18L77 33L44 49L12 33Z" fill="white"/>
          <path d="M44 32L70 42V60" stroke="#ffb987" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="70" cy="64" r="5" fill="#ffce9f"/>
          <path d="M28 55C38 63 50 63 60 55" stroke="#f0b185" strokeWidth="3" strokeLinecap="round"/>
        </> : null}
        {kind === "attendance" ? <>
          <rect x="18" y="23" width="52" height="48" rx="11" fill={`url(#${id}-paper)`}/><path d="M18 34H70" stroke="#dacbf7" strokeWidth="3"/>
          <path d="M31 17V28M57 17V28" stroke="#9b79d6" strokeWidth="5" strokeLinecap="round"/>
          <circle cx="45" cy="51" r="13" fill="#a085df"/><path d="M38 51L43 56L52 46" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </> : null}
        {kind === "train" ? <>
          <rect x="21" y="22" width="40" height="51" rx="8" transform="rotate(-13 21 22)" fill="#ffcf9c"/>
          <rect x="30" y="18" width="40" height="51" rx="8" transform="rotate(10 30 18)" fill={`url(#${id}-paper)`}/>
          <path d="M49 30L46 41L37 43L46 48L47 59L53 49L64 47L54 41L55 30L49 35Z" fill="#ab85e9"/>
        </> : null}
        {kind === "schedule" ? <>
          <rect x="17" y="22" width="48" height="46" rx="10" fill={`url(#${id}-paper)`}/><path d="M29 17V28M53 17V28" stroke="#ffbc8a" strokeWidth="5" strokeLinecap="round"/>
          <path d="M26 37H53M27 47H31M39 47H43M27 57H31" stroke="#c5b2eb" strokeWidth="4" strokeLinecap="round"/>
          <circle cx="61" cy="59" r="16" fill="#ffcd9e"/><path d="M61 49V59L68 63" stroke="#9c70c3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </> : null}
        {kind === "zaps" ? <>
          <path d="M18 28A7 7 0 0 1 25 21H64A7 7 0 0 1 71 28V61A7 7 0 0 1 64 68H25A7 7 0 0 1 18 61Z" fill={`url(#${id}-paper)`}/>
          <path d="M20 28L44 47L69 28" stroke="#c4a7ea" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M54 54H76M68 46L77 54L68 62" stroke="#a07ad9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        </> : null}
      </g>
    </g>
    <rect x="2.5" y="2.5" width="83" height="83" rx="24.5" stroke="white" strokeOpacity=".2"/>
  </svg>;
}
