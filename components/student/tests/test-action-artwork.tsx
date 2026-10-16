import { useId } from "react";

export type TestActionKind = "start" | "resume" | "submit" | "practice" | "review";

/** Original miniature illustrations in the student launcher's visual language. */
export function TestActionArtwork({kind}:{kind:TestActionKind}) {
  const id=useId().replaceAll(":","");
  const warm=kind==="start"||kind==="resume"||kind==="submit";
  return <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-tile`} x1="13" y1="4" x2="74" y2="85" gradientUnits="userSpaceOnUse"><stop stopColor={warm?"#ffbd89":"#c4a4ff"}/><stop offset="1" stopColor={warm?"#f37a59":"#8860d8"}/></linearGradient>
      <linearGradient id={`${id}-paper`} x1="25" y1="18" x2="64" y2="71" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset="1" stopColor="#eee7ff"/></linearGradient>
      <clipPath id={`${id}-clip`}><rect x="2" y="2" width="84" height="84" rx="25"/></clipPath>
      <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dy="3" stdDeviation="2" floodColor={warm?"#ad5339":"#62449e"} floodOpacity=".24"/></filter>
    </defs>
    <g clipPath={`url(#${id}-clip)`}>
      <rect x="2" y="2" width="84" height="84" rx="25" fill={`url(#${id}-tile)`}/>
      <circle cx="75" cy="9" r="34" fill="#fff" opacity=".11"/>
      <path d="M-7 64C14 37 35 78 60 55C77 39 89 42 97 52V94H-7Z" fill={warm?"#ffe6ac":"#ffd5ab"} opacity=".25"/>
      <g filter={`url(#${id}-shadow)`}>
        {kind==="start"?<>
          <rect x="23" y="22" width="39" height="48" rx="7" transform="rotate(-8 23 22)" fill="#ffd8ab"/>
          <rect x="25" y="17" width="39" height="48" rx="7" fill={`url(#${id}-paper)`}/>
          <path d="M34 29h20M34 38h13M34 47h8" stroke="#c1a4e8" strokeWidth="3.5" strokeLinecap="round"/>
          <circle cx="60" cy="60" r="16" fill="#a47ae5"/><path d="m56 52 12 8-12 8V52Z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/>
        </>:null}
        {kind==="practice"?<>
          <rect x="18" y="25" width="37" height="47" rx="7" transform="rotate(-13 18 25)" fill="#ffd3a2"/>
          <rect x="32" y="15" width="38" height="49" rx="8" transform="rotate(10 32 15)" fill={`url(#${id}-paper)`}/>
          <path d="m51 28 3 10 10 4-10 4-4 11-3-11-10-4 10-4 4-10Z" fill="#ad87e7"/>
          <path d="m24 19 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#fff0d5"/>
        </>:null}
        {kind==="resume"?<>
          <rect x="22" y="18" width="40" height="50" rx="8" fill={`url(#${id}-paper)`}/>
          <path d="M32 30h20M32 39h14" stroke="#c5adeb" strokeWidth="3.5" strokeLinecap="round"/>
          <circle cx="59" cy="58" r="18" fill="#b18ae9"/>
          <path d="M48 56a11 11 0 1 1 4 11M48 49v8h8" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M59 51v8l5 3" stroke="#ffddb5" strokeWidth="3" strokeLinecap="round"/>
        </>:null}
        {kind==="submit"?<>
          <rect x="17" y="31" width="51" height="36" rx="8" fill={`url(#${id}-paper)`}/>
          <path d="m20 36 22 17 23-17" stroke="#c7adeb" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="m40 25 34-10-11 32-8-13-15-9Z" fill="#b18be9" stroke="#b18be9" strokeWidth="3" strokeLinejoin="round"/>
          <path d="m55 34 17-17" stroke="#f5ecff" strokeWidth="3" strokeLinecap="round"/>
          <path d="M19 22h9M14 27h7" stroke="#ffe6bb" strokeWidth="3" strokeLinecap="round"/>
        </>:null}
        {kind==="review"?<>
          <rect x="23" y="17" width="39" height="51" rx="7" fill={`url(#${id}-paper)`}/>
          <path d="m31 30 3 3 5-6M43 30h10M31 43h21M31 52h12" stroke="#b095db" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="60" cy="57" r="14" fill="#ffdbaf"/><circle cx="59" cy="55" r="8" fill="#fff6e6" stroke="#b08adc" strokeWidth="3"/>
          <path d="m65 61 8 9" stroke="#a47cda" strokeWidth="5" strokeLinecap="round"/>
        </>:null}
      </g>
    </g>
    <rect x="2.5" y="2.5" width="83" height="83" rx="24.5" stroke="#fff" strokeOpacity=".24"/>
  </svg>;
}
