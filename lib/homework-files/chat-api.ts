import { apiRequest } from "@/lib/api/client";

export interface ChatMessage { id:number; client_message_id:string|null; sender_role:string; sender_id:number|null; kind:"user"|"system"; body:string|null; event_code:string|null; created_at:string }
export const homeworkChatApi={
  thread:(homeworkId:number,studentId?:number)=>apiRequest<{thread:{id:number}|null}>(`/api/homework-chat/thread?homework_id=${homeworkId}${studentId?`&student_id=${studentId}`:""}`),
  history:(threadId:number,after=0)=>apiRequest<{items:ChatMessage[]}>(`/api/homework-chat/threads/${threadId}/messages?after=${after}`),
  send:(homeworkId:number,text:string,studentId?:number)=>apiRequest<{id:number;thread_id:number;message:ChatMessage}>("/api/homework-chat/messages",{method:"POST",body:JSON.stringify({homework_id:homeworkId,student_id:studentId,text,client_message_id:crypto.randomUUID()})}),
  read:(threadId:number,messageId:number)=>apiRequest(`/api/homework-chat/threads/${threadId}/read`,{method:"POST",body:JSON.stringify({message_id:messageId})}),
  typing:(threadId:number,active:boolean)=>apiRequest(`/api/homework-chat/threads/${threadId}/typing`,{method:"POST",body:JSON.stringify({active})}),
  presence:(threadId:number)=>apiRequest<{items:{actor_role:string;actor_id:number}[]}>(`/api/homework-chat/threads/${threadId}/presence`),
  reads:(threadId:number)=>apiRequest<{items:{reader_role:string;reader_id:number;last_message_id:number}[]}>(`/api/homework-chat/threads/${threadId}/reads`),
};
