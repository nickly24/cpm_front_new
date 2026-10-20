import {beforeEach,describe,expect,it,vi} from "vitest";
const {domain,external}=vi.hoisted(()=>({domain:vi.fn(),external:vi.fn()}));
vi.mock("@/lib/config",()=>({BFF_DEV:true,BFF_EXTERNAL_TESTS_DEV:true}));
vi.mock("@/lib/bff/client",()=>({domain,getIdentity:()=>({context_revision:"qa",user:{division_id:11}})}));
vi.mock("./external-tests",()=>({externalCatalog:external,externalResultItems:external,externalAdminItem:(t:{id:string;name:string})=>({id:t.id,title:t.name,isExternal:true})}));
const test={id:"a".repeat(24),title:"Серверная карточка",placements:[],actions:{},direction_id:13,direction_name:"Право",revision:1};
beforeEach(()=>{domain.mockReset();external.mockReset();});
describe("one administrative catalogue server page",()=>{
 it("requests one bounded merged page with all filters, server counts and abort signal",async()=>{
  domain.mockResolvedValue({items:[{test},{external_test:{id:"b".repeat(24),name:"Внешний"}}],total:50000,limit:6,offset:12,status_counts:{all:50000,hidden:17,external:10}});
  const {testsCatalogPage}=await import("./tests-admin");const signal=new AbortController().signal;
  const data=await testsCatalogPage({page:3,directionId:13,q:" право ",status:"hidden",dateFrom:"2026-10-01",dateTo:"2026-10-20",relation:"owned",ownerDivisionId:"11",archived:"all",signal});
  expect(domain).toHaveBeenCalledTimes(1);expect(external).not.toHaveBeenCalled();
  const [path,options]=domain.mock.calls[0];expect(path).toMatch(/^\/tests\/catalog\?/);
  expect(Object.fromEntries(new URLSearchParams(path.split("?")[1]))).toEqual({view:"admin",limit:"6",offset:"12",include_external:"true",direction_id:"13",q:"право",status:"hidden",date_from:"2026-10-01",date_to:"2026-10-20",relation:"owned",owner_division_id:"11",is_archived:"all"});
  expect(options.signal).toBe(signal);expect(data.total).toBe(50000);expect(data.statusCounts.hidden).toBe(17);expect(data.items.map(t=>t.id)).toEqual([test.id,"b".repeat(24)]);expect(path).not.toContain("target_division_id");expect(path).not.toContain("organization_id");
 });
 it("pages the bank without including external tests",async()=>{
  domain.mockResolvedValue({items:[],total:0,limit:6,offset:0,status_counts:{all:0}});const {testsCatalogPage}=await import("./tests-admin");await testsCatalogPage({bank:true,archived:"true"});
  expect(domain).toHaveBeenCalledTimes(1);expect(domain.mock.calls[0][0]).toContain("/tests/bank?");expect(domain.mock.calls[0][0]).toContain("include_external=false");
 });
 it("accepts server page clamping without enumerating preceding pages",async()=>{
  domain.mockResolvedValue({items:[{test}],total:7,limit:6,offset:6,status_counts:{all:7}});const {testsCatalogPage}=await import("./tests-admin");expect((await testsCatalogPage({page:50})).offset).toBe(6);expect(domain).toHaveBeenCalledTimes(1);
 });
 it("fails against an older response without falling back to all-pages loading",async()=>{
  domain.mockResolvedValue({items:[test],total:1000,limit:6,offset:0});const {testsCatalogPage}=await import("./tests-admin");await expect(testsCatalogPage()).rejects.toThrow("версию сервера");expect(domain).toHaveBeenCalledTimes(1);expect(external).not.toHaveBeenCalled();
 });
 it("rejects unsafe pagination before requesting",async()=>{
  const {testsCatalogPage}=await import("./tests-admin");for(const filter of [{page:0},{page:1.5},{limit:101},{limit:0},{page:20000}])await expect(testsCatalogPage(filter)).rejects.toThrow("страница");expect(domain).not.toHaveBeenCalled();
 });
});
