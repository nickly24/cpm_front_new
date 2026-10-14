import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeworkInfrastructure, homeworkInfrastructureLabel } from "./homework-infrastructure";
import type { MonitoringData } from "@/lib/homework-files/api";
const data: MonitoringData = { jobs: [], recent_jobs: [], warnings: [], organization_id: 1001, division_id: 12, processing_ready: true, delivery: { connected: true, pending: 0 }, worker: { state: "ok", received_at: null, observed_at: null, rabbitmq: true, tools: true, processing: false, fresh_instances: 1 }, storage: { state: "ok", checked_at: null } };
describe("honest Homework infrastructure UI", () => {
  it("labels missing, stale and error observations separately from a healthy process", () => {
    expect(homeworkInfrastructureLabel("unknown")).toBe("Нет данных"); expect(homeworkInfrastructureLabel("stale")).toBe("Сигнал устарел"); expect(homeworkInfrastructureLabel("error")).toBe("Недоступно");
  });
  it("never displays previous processing readiness as currently healthy after a failed refresh", () => {
    const markup = renderToStaticMarkup(<HomeworkInfrastructure data={data} stale />);
    expect(markup).toContain("Не подтверждена"); expect(markup).toContain("последний полученный ответ"); expect(markup).not.toContain("<strong>Готова</strong>");
    expect(markup).toContain("Брокер Homework"); expect(markup).toContain("Обработчик PDF"); expect(markup).toContain("Хранилище PDF"); expect(markup).not.toContain("файлов</strong>");
  });
});
