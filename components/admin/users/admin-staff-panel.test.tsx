// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const state=vi.hoisted(()=>({create:vi.fn(),catalog:vi.fn(),actor:{account_id:1,organization_id:1,division_id:10,organization_admin:true,role:"admin"}}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:state.actor})}));
vi.mock("@/lib/config",()=>({BFF_DEV:true}));
vi.mock("@/lib/bff/use-context-guard",()=>({useContextGuard:vi.fn()}));
vi.mock("@/lib/bff/core-admin",()=>({coreFullAdmin:()=>true,coreCan:()=>true,coreRoles:vi.fn()}));
vi.mock("@/lib/bff/core-organization",()=>({coreOrganizationCatalog:state.catalog}));
vi.mock("@/lib/admin/admin-users-api",()=>({addAdminStaffUser:state.create,editAdminStaffUser:vi.fn()}));
vi.mock("./core-access",()=>({CoreCreateRecovery:()=>null}));
import { AdminStaffPanel } from "./admin-staff-panel";
afterEach(cleanup);
describe("examiner creation form",()=>{
 it("creates the account and chosen memberships together, retaining current division and preventing duplicate creation",async()=>{
  state.catalog.mockResolvedValue({organization:{id:1},directions:[],divisions:[{id:10,name:"Основная",is_active:1},{id:20,name:"Вторая",is_active:1},{id:30,name:"Архив",is_active:0}]});
  state.create.mockResolvedValue({status:true,user_data:{id:40,login:"examiner",password:"SyntheticPass9"}});
  render(<AdminStaffPanel mode="add" role="examinator" user={null} groups={[]} onClose={()=>{}} onSaved={()=>{}}/>);
  const current=await screen.findByRole("checkbox",{name:/Основная/}) as HTMLInputElement;expect(current.checked).toBe(true);expect(current.disabled).toBe(true);expect(screen.queryByRole("checkbox",{name:/Архив/})).toBeNull();
  fireEvent.click(screen.getByRole("checkbox",{name:"Вторая"}));
  fireEvent.change(screen.getByLabelText("ФИО"),{target:{value:"Экзаменатор"}});fireEvent.change(screen.getByLabelText("Логин"),{target:{value:"examiner"}});fireEvent.change(screen.getByLabelText(/^Пароль/),{target:{value:"SyntheticPass9"}});
  fireEvent.click(screen.getByRole("button",{name:"Создать"}));
  await waitFor(()=>expect(state.create).toHaveBeenCalledWith("examinator",expect.objectContaining({full_name:"Экзаменатор",login:"examiner",division_ids:[20]})));
  await screen.findByText("Пользователь создан.");expect(screen.queryByRole("button",{name:"Создать"})).toBeNull();expect((screen.getByRole("checkbox",{name:"Вторая"}) as HTMLInputElement).closest("fieldset")?.disabled).toBe(true);
 });
});
