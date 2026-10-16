// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { isValidSection } from "@/lib/navigation";
import { StudentIosInstallSection } from "./student-ios-install-section";
afterEach(cleanup);
it("steps through the demonstration and supports selecting a step directly",()=>{
 render(<StudentIosInstallSection/>);
 const previous=screen.getByRole("button",{name:"Предыдущий шаг"}),next=screen.getByRole("button",{name:"Следующий шаг"});
 expect((previous as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(next);expect(screen.getByRole("button",{name:/2 Нажмите/}).getAttribute("aria-current")).toBe("step");
 fireEvent.click(screen.getByRole("button",{name:/4 Добавьте/}));expect((next as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(previous);expect(screen.getByRole("button",{name:/3 Выберите/}).getAttribute("aria-current")).toBe("step");
});
it("exposes the instructions as a student-only route",()=>{
 expect(isValidSection("student","install-ios")).toBe(true);
 expect(isValidSection("admin","install-ios")).toBe(false);
});
