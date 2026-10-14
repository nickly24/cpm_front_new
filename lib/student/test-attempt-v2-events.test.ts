import { beforeEach, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => ({user:{account_id:9,organization_id:1,division_id:1001}}));
vi.mock("@/lib/config", () => ({BFF_DEV:true}));
vi.mock("@/lib/bff/client", () => ({getIdentity:()=>identity}));
import { attemptDatabaseName } from "./test-attempt-db";
import { announceAttemptChange, subscribeAttemptChanges } from "./test-attempt-v2-events";
class Channel {
  static channels = new Set<Channel>();
  onmessage?: (event:{data:unknown})=>void;
  constructor(readonly name:string){Channel.channels.add(this);}
  postMessage(data:unknown){for(const channel of Channel.channels) if(channel!==this && channel.name===this.name) channel.onmessage?.({data});}
  close(){Channel.channels.delete(this);}
}
beforeEach(()=>{
  Channel.channels.clear();
  identity.user.division_id=1001;
  vi.stubGlobal("BroadcastChannel",Channel);
  vi.stubGlobal("window",new EventTarget());
  vi.stubGlobal("document",Object.assign(new EventTarget(),{visibilityState:"visible"}));
});
it("refreshes for another tab, without applying its own storage notifications",()=>{
  const refresh=vi.fn();const stop=subscribeAttemptChanges("attempt",refresh);
  announceAttemptChange("attempt");expect(refresh).not.toHaveBeenCalled();
  const remote=new Channel(`${attemptDatabaseName()}:changes`);
  remote.postMessage({attemptId:"attempt",source:"other-tab"});expect(refresh).toHaveBeenCalledTimes(1);
  remote.postMessage({attemptId:"unrelated",source:"other-tab"});expect(refresh).toHaveBeenCalledTimes(1);
  stop();remote.postMessage({attemptId:"attempt",source:"other-tab"});expect(refresh).toHaveBeenCalledTimes(1);
});
it("does not mix accounts/divisions, including after a context switch",()=>{
  const refresh=vi.fn();const stop=subscribeAttemptChanges("attempt",refresh);
  const oldScope=new Channel(`${attemptDatabaseName()}:changes`);
  identity.user.division_id=1002;
  const newScope=new Channel(`${attemptDatabaseName()}:changes`);
  newScope.postMessage({attemptId:"attempt",source:"other-tab"});
  oldScope.postMessage({attemptId:"attempt",source:"other-tab"});
  expect(refresh).not.toHaveBeenCalled();stop();
});
