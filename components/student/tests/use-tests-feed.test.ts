// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTestsFeed } from "./use-tests-feed";
import type { TestsWithSessionsResponse } from "@/lib/student/tests-types";
afterEach(cleanup);
const page = (number: number): TestsWithSessionsResponse => ({ tests: Array.from({ length: 6 }, (_, index) => ({ id: String((number - 1) * 6 + index), title: "Тест", status: "available" })), sessions: [], pagination: { current_page: number, total_pages: 3, total_items: 18, items_per_page: 6 } });

it("refreshes all previously loaded pages after an attempt without collapsing the feed", async () => {
  const loadPage = vi.fn(async (number: number) => page(number));
  const { result, rerender } = renderHook(({ revision }) => useTestsFeed({ queryKey: "all", enabled: true, mobile: true, page: 1, revision, loadPage }), { initialProps: { revision: 0 } });
  await waitFor(() => expect(result.current.tests).toHaveLength(6));
  act(() => result.current.loadNext()); await waitFor(() => expect(result.current.tests).toHaveLength(12));
  loadPage.mockClear();
  rerender({ revision: 1 });
  expect(result.current.tests).toHaveLength(12);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(loadPage.mock.calls.map(call => call[0])).toEqual([1, 2]);
  expect(result.current.tests).toHaveLength(12);
});

it("deduplicates page boundaries and refreshes only pages awaiting calculation when polling", async () => {
  const loadPage = vi.fn(async (number: number) => {
    const response = page(number);
    if (number === 2) { response.tests[0].id = "5"; response.tests[1].status = "checking"; }
    return response;
  });
  const { result } = renderHook(() => useTestsFeed({ queryKey: "all", enabled: true, mobile: true, page: 1, revision: 0, loadPage }));
  await waitFor(() => expect(result.current.tests).toHaveLength(6));
  act(() => result.current.loadNext()); await waitFor(() => expect(result.current.tests).toHaveLength(11));
  loadPage.mockClear();
  act(() => { result.current.refreshChecking(); result.current.refreshChecking(); });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(loadPage.mock.calls.map(call => call[0])).toEqual([2]);
  expect(result.current.tests).toHaveLength(11);
});

it("retries a failed calculation refresh on its own page rather than appending another one", async () => {
  const loadPage = vi.fn(async (number: number) => {
    const response = page(number);
    if (number === 2) response.tests[0].status = "checking";
    return response;
  });
  const { result } = renderHook(() => useTestsFeed({ queryKey: "all", enabled: true, mobile: true, page: 1, revision: 0, loadPage }));
  await waitFor(() => expect(result.current.tests).toHaveLength(6));
  act(() => result.current.loadNext()); await waitFor(() => expect(result.current.tests).toHaveLength(12));
  loadPage.mockClear(); loadPage.mockRejectedValueOnce(new Error("Нет сети"));
  act(() => result.current.refreshChecking()); await waitFor(() => expect(result.current.error).toBe("Нет сети"));
  expect(result.current.tests).toHaveLength(12);
  act(() => result.current.retry()); await waitFor(() => expect(result.current.error).toBeNull());
  expect(loadPage.mock.calls.map(call => call[0])).toEqual([2, 2]);
});

it("stops loading when the server total shrinks while another page is requested", async () => {
  const loadPage = vi.fn(async (number: number) => page(number));
  const { result } = renderHook(() => useTestsFeed({ queryKey: "all", enabled: true, mobile: true, page: 1, revision: 0, loadPage }));
  await waitFor(() => expect(result.current.tests).toHaveLength(6));
  loadPage.mockResolvedValueOnce({ tests: [], sessions: [], pagination: { current_page: 2, total_pages: 1, total_items: 6, items_per_page: 6 } });
  act(() => result.current.loadNext());
  await waitFor(() => expect(result.current.hasNext).toBe(false));
  expect(result.current.tests).toHaveLength(6);
  expect(result.current.pagination?.total_items).toBe(6);
  act(() => result.current.loadNext());
  expect(loadPage).toHaveBeenCalledTimes(2);
});
