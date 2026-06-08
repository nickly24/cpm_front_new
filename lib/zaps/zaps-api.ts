import { apiRequest } from "@/lib/api/client";
import type { AdminListPagination } from "@/lib/admin/admin-tests-monitoring-types";
import type {
  AdminZapListItem,
  CreateZapPayload,
  CreateZapResponse,
  FetchAllZapsParams,
  ProcessZapPayload,
  ProcessZapResponse,
  RetryZapDateResponse,
  StudentZapListItem,
  StudentZapsResponse,
  ZapDateItem,
  ZapDetailResponse,
  ZapsListApiPagination,
  ZapsListResponse,
} from "./zaps-types";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

type ZapsListApiPaginationRaw = ZapsListApiPagination & {
  current_page?: number;
  total_items?: number;
  items_per_page?: number;
};

function normalizePagination(
  raw: ZapsListApiPaginationRaw | undefined,
  fallback: { page: number; limit: number; total: number },
): AdminListPagination {
  if (!raw) {
    const totalPages = Math.max(1, Math.ceil(fallback.total / fallback.limit));
    const page = Math.min(fallback.page, totalPages);
    return {
      page,
      limit: fallback.limit,
      total: fallback.total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  const page = raw.page ?? raw.current_page ?? fallback.page;
  const limit = raw.limit ?? raw.items_per_page ?? fallback.limit;
  const total = raw.total ?? raw.total_items ?? fallback.total;
  const totalPages = Math.max(
    1,
    raw.total_pages ??
      raw.totalPages ??
      (total > 0 ? Math.ceil(total / limit) : 1),
  );
  const safePage = Math.min(Math.max(1, page), totalPages);

  return {
    page: safePage,
    limit,
    total,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

export async function createZap(
  payload: CreateZapPayload,
): Promise<CreateZapResponse> {
  return apiRequest<CreateZapResponse>("/api/create-zap", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchStudentZaps(
  studentId: number,
): Promise<StudentZapListItem[]> {
  const data = await apiRequest<StudentZapsResponse>("/api/get-zaps-student", {
    method: "POST",
    body: JSON.stringify({ student_id: studentId }),
  });
  return data.status && data.zaps ? data.zaps : [];
}

type ZapDetailApiResponse = ZapDetailResponse & {
  zap?: ZapDetailResponse["zap"] & { dates?: ZapDateItem[] };
};

export async function fetchZapById(zapId: number): Promise<ZapDetailResponse> {
  const data = await apiRequest<ZapDetailApiResponse>(`/api/get-zap/${zapId}`);
  const dates = data.dates ?? data.zap?.dates ?? [];
  return { ...data, dates };
}

type ZapsListApiResponse = {
  status: boolean;
  zaps?: AdminZapListItem[];
  pagination?: ZapsListApiPagination;
  error?: string;
};

export async function fetchAllZaps(
  params: FetchAllZapsParams,
): Promise<ZapsListResponse> {
  const status =
    params.status && params.status !== "all" ? params.status : undefined;

  const data = await apiRequest<ZapsListApiResponse>(
    `/api/get-all-zaps${buildQuery({
      status,
      page: params.page,
      limit: params.limit,
    })}`,
  );

  if (!data.status) {
    return {
      status: false,
      zaps: [],
      error: data.error ?? "Не удалось загрузить запросы",
    };
  }

  const zaps = Array.isArray(data.zaps) ? data.zaps : [];
  const pagination = normalizePagination(data.pagination, {
    page: params.page,
    limit: params.limit,
    total: zaps.length,
  });

  return {
    status: true,
    zaps,
    pagination,
  };
}

export async function processZap(
  payload: ProcessZapPayload,
): Promise<ProcessZapResponse> {
  return apiRequest<ProcessZapResponse>("/api/process-zap", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function retryZapDate(dateId: number): Promise<RetryZapDateResponse> {
  return apiRequest<RetryZapDateResponse>(`/api/zap-dates/${dateId}/retry`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
