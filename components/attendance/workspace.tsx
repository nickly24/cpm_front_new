"use client";
import { AttendanceCalendar } from "./calendar";
import { AttendanceJournal } from "./journal";
import { AttendanceZaps } from "./zaps";
export function AttendanceWorkspace({ section }: {
    section: string;
}) { if (section === "schedule")
    return <AttendanceCalendar />; if (section === "zaps")
    return <AttendanceZaps />; return <AttendanceJournal scan={section === "scan"}/>; }
