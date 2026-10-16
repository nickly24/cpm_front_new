import { useId } from "react";
import type { StudentNavIconKind } from "./student-nav-icon";

/** Compact standalone artwork: no tile or background behind the symbol. */
export function StudentSidebarIcon({kind}:{kind:StudentNavIconKind|"menu"}) {
  const id=`sidebar-${useId().replaceAll(":","")}`;
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-violet`} x1="6" y1="6" x2="34" y2="35" gradientUnits="userSpaceOnUse"><stop stopColor="#b098fa"/><stop offset="1" stopColor="#7655d9"/></linearGradient>
      <linearGradient id={`${id}-orange`} x1="9" y1="7" x2="34" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#ffd19c"/><stop offset="1" stopColor="#f18459"/></linearGradient>
    </defs>
    {kind==="menu"?<><path d="M5 18 20 5l15 13v15a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z" fill={`url(#${id}-violet)`}/><path d="m3 18 17-14 17 14" stroke={`url(#${id}-orange)`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 36V24a4 4 0 0 1 8 0v12" fill="#fff3e4"/></>:null}
    {kind==="homework"?<><path d="M9 5h16l6 7v21a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" fill={`url(#${id}-violet)`}/><path d="M24 5v8h7M12 15h7m-7 7h9m-9 7h5" stroke="#ede4ff" strokeWidth="2.5" strokeLinecap="round"/><path d="m25 27 8-16 5 3-8 16-6 4Z" fill={`url(#${id}-orange)`}/></>:null}
    {kind==="tests"?<><rect x="8" y="6" width="25" height="31" rx="5" fill={`url(#${id}-orange)`}/><rect x="14" y="3" width="13" height="7" rx="3.5" fill={`url(#${id}-violet)`}/><path d="m13 18 3 3 5-6m-8 14 3 3 5-6" stroke="#fff" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M25 18h3m-3 11h3" stroke="#986acb" strokeWidth="2.5" strokeLinecap="round"/></>:null}
    {kind==="exams"?<><path d="M9 19v11c5 8 17 8 22 0V19" fill={`url(#${id}-orange)`}/><path d="M2 15 20 5l18 10-18 11Z" fill={`url(#${id}-violet)`}/><path d="m20 15 15 8v9" stroke="#ffbf86" strokeWidth="2.5" strokeLinecap="round"/><circle cx="35" cy="34" r="3" fill="#f59c68"/></>:null}
    {kind==="attendance"?<><rect x="5" y="8" width="30" height="28" rx="6" fill={`url(#${id}-orange)`}/><path d="M5 16h30M12 4v8m16-8v8" stroke={`url(#${id}-violet)`} strokeWidth="3" strokeLinecap="round"/><circle cx="21" cy="25" r="8" fill={`url(#${id}-violet)`}/><path d="m17 25 3 3 5-6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></>:null}
    {kind==="train"?<><rect x="3" y="9" width="23" height="28" rx="4" transform="rotate(-12 3 9)" fill={`url(#${id}-orange)`}/><rect x="13" y="3" width="23" height="29" rx="4" transform="rotate(9 13 3)" fill={`url(#${id}-violet)`}/><path d="m23 10 2 6 6 1-5 4 1 6-5-3-5 3 1-6-4-4 6-1Z" fill="#fff0d7"/></>:null}
    {kind==="schedule"?<><rect x="4" y="7" width="27" height="27" rx="5" fill={`url(#${id}-violet)`}/><path d="M11 3v8m13-8v8" stroke={`url(#${id}-orange)`} strokeWidth="3" strokeLinecap="round"/><path d="M10 17h14m-14 6h5" stroke="#e9deff" strokeWidth="2.4" strokeLinecap="round"/><circle cx="29" cy="28" r="10" fill={`url(#${id}-orange)`}/><path d="M29 22v7l4 2" stroke="#8659c0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></>:null}
    {kind==="zaps"?<><rect x="3" y="9" width="32" height="24" rx="5" fill={`url(#${id}-violet)`}/><path d="m5 12 14 11 14-11" stroke="#e7d9ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M23 30h14m-6-6 6 6-6 6" stroke={`url(#${id}-orange)`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></>:null}
  </svg>;
}
