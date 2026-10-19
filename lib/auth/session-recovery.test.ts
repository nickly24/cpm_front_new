import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/config", () => ({ BFF_DEV:true }));
vi.mock("@/lib/bff/client", () => ({ bffRequest:vi.fn(),acceptIdentity:vi.fn(),announceSession:vi.fn(),exclusiveContext:vi.fn() }));
import { bffRequest, acceptIdentity, announceSession } from "@/lib/bff/client";
import { loginRequest } from "./api";
beforeEach(()=>vi.clearAllMocks());
describe("existing BFF session recovery",()=>{
 it("restores the authenticated cabinet after a false logout without resending credentials",async()=>{
  const identity={status:true},user={account_id:7,full_name:"Администратор"};
  vi.mocked(bffRequest).mockRejectedValueOnce(Object.assign(new Error("session_exists"),{code:"session_exists",status:409})).mockResolvedValueOnce(identity);
  vi.mocked(acceptIdentity).mockReturnValue(user as ReturnType<typeof acceptIdentity>);
  expect(await loginRequest("admin","synthetic")).toEqual({user});
  expect(bffRequest).toHaveBeenCalledTimes(2);expect(bffRequest).toHaveBeenNthCalledWith(2,"/auth/me");expect(announceSession).toHaveBeenCalledOnce();
 });
 it("preserves an ordinary invalid-credentials error",async()=>{
  vi.mocked(bffRequest).mockRejectedValueOnce(new Error("Неверный логин или пароль"));
  expect(await loginRequest("admin","wrong")).toEqual({error:"Неверный логин или пароль"});expect(bffRequest).toHaveBeenCalledTimes(1);
 });
});
