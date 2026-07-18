import { apiFormRequest, apiRequest } from "@/lib/api/client";
import type { HomeworkWorkspace, ReviewQueueItem, UploadJob } from "./types";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/auth/storage";

export const homeworkFilesApi = {
  workspace: (homeworkId: number, studentId?: number) =>
    apiRequest<HomeworkWorkspace>(`/api/homework-files/workspace/${homeworkId}${studentId ? `?student_id=${studentId}` : ""}`),
  upload: (homeworkId: number, file: File, clientId: string) => {
    const data = new FormData(); data.append("file", file); data.append("client_upload_id", clientId);
    return apiFormRequest<UploadJob>(`/api/homework-files/workspace/${homeworkId}/upload`, data);
  },
  job: (id: string) => apiRequest<UploadJob>(`/api/homework-files/jobs/${id}`),
  jobs: () => apiRequest<{ items: UploadJob[] }>("/api/homework-files/jobs"),
  cancel: (id: string) => apiRequest(`/api/homework-files/jobs/${id}/cancel`, { method: "POST" }),
  retry: (id: string) => apiRequest(`/api/homework-files/jobs/${id}/retry`, { method: "POST" }),
  submit: (homeworkId: number) => apiRequest(`/api/homework-files/workspace/${homeworkId}/submit`, { method: "POST" }),
  queue: (state?: string) => apiRequest<{ items: ReviewQueueItem[]; next_cursor: number | null }>(`/api/homework-files/review-queue${state ? `?state=${state}` : ""}`),
  transition: (id: number, action: string, payload: object = {}) => apiRequest(`/api/homework-files/submissions/${id}/${action}`, { method: "POST", body: JSON.stringify(payload) }),
  fileUrl: (id: number, draft = false, download = false) => apiRequest<{ url: string }>(`/api/homework-files/submissions/${id}/file-url?draft=${draft ? 1 : 0}&download=${download ? 1 : 0}`),
};

export function uploadHomeworkFile(homeworkId:number,file:File,clientId:string,onProgress:(value:number)=>void,signal?:AbortSignal){
  return new Promise<UploadJob>((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open("POST",`${API_BASE_URL}/api/homework-files/workspace/${homeworkId}/upload`);xhr.withCredentials=true;const token=getToken();if(token)xhr.setRequestHeader("Authorization",`Bearer ${token}`);const abort=()=>xhr.abort();signal?.addEventListener("abort",abort,{once:true});xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.max(1,Math.round(event.loaded/event.total*100)))};xhr.onerror=()=>reject(new Error("Не удалось загрузить файл. Проверьте интернет."));xhr.onabort=()=>reject(new Error("Загрузка отменена"));xhr.onload=()=>{signal?.removeEventListener("abort",abort);let data:UploadJob&{error?:string};try{data=JSON.parse(xhr.responseText)}catch{data={} as UploadJob}if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(new Error(data.error??"Ошибка загрузки"))};const form=new FormData();form.append("file",file);form.append("client_upload_id",clientId);xhr.send(form)})
}
