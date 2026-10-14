import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AttendanceZapDecision } from "./zaps";
import type { Zap } from "@/lib/bff/attendance";

describe("attendance zap decision controls", () => {
    it.each<Zap["status"]>(["pending", "approved", "rejected"])("allows an empty answer and both decisions for %s requests", status => {
        const html = renderToStaticMarkup(createElement(AttendanceZapDecision, { status, answer: "", disabled: false, onAnswer: vi.fn(), onDecision: vi.fn() }));
        expect(html).toContain("Одобрить отгул");
        expect(html).toContain("Отклонить отгул");
        expect(html).not.toContain("disabled");
        expect(html).not.toContain("required");
        expect(html).toContain('maxLength="5000"');
    });
    it("keeps both decision buttons disabled while the current command is unresolved", () => {
        const html = renderToStaticMarkup(createElement(AttendanceZapDecision, { status: "approved", answer: "Ответ", disabled: true, onAnswer: vi.fn(), onDecision: vi.fn() }));
        expect(html.match(/disabled=""/g)).toHaveLength(2);
        expect(html).toContain("Ответ</textarea>");
        expect(html).toContain("Решение можно изменить");
    });
});
