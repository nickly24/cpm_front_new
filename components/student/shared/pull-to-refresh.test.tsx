// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRef } from "react";
import { usePullToRefresh } from "./pull-to-refresh";
afterEach(cleanup);
function Harness({ refresh, loading = false }: { refresh: () => void; loading?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const distance = usePullToRefresh(ref, { loading, onRefresh: refresh });
  return <div ref={ref} data-testid="list" data-distance={distance}><button>Задание</button></div>;
}
const touch = (x: number, y: number) => [{ clientX: x, clientY: y }];
it("refreshes only after a deliberate downward pull at the top and prevents repeats", () => {
  const refresh = vi.fn(); render(<Harness refresh={refresh}/>);
  const list = screen.getByTestId("list");
  fireEvent.touchStart(list, { touches: touch(20, 20) });
  fireEvent.touchMove(list, { touches: touch(20, 80), cancelable: true });
  fireEvent.touchEnd(list); expect(refresh).not.toHaveBeenCalled();
  fireEvent.touchStart(list, { touches: touch(20, 20) });
  fireEvent.touchMove(list, { touches: touch(20, 160), cancelable: true });
  fireEvent.touchEnd(list); expect(refresh).toHaveBeenCalledOnce();
  fireEvent.touchStart(list, { touches: touch(20, 20) });
  fireEvent.touchMove(list, { touches: touch(20, 180), cancelable: true });
  fireEvent.touchEnd(list); expect(refresh).toHaveBeenCalledOnce();
});
it("ignores scrolling away from the top, horizontal gestures, loading and cancelled touches", () => {
  const refresh = vi.fn(); const page = render(<Harness refresh={refresh}/>); const list = screen.getByTestId("list");
  list.scrollTop = 40;
  fireEvent.touchStart(list, { touches: touch(20, 20) }); fireEvent.touchMove(list, { touches: touch(20, 180) }); fireEvent.touchEnd(list);
  list.scrollTop = 0;
  fireEvent.touchStart(list, { touches: touch(20, 20) }); fireEvent.touchMove(list, { touches: touch(200, 80) }); fireEvent.touchEnd(list);
  fireEvent.touchStart(list, { touches: touch(20, 20) }); fireEvent.touchMove(list, { touches: touch(20, 180), cancelable: true }); fireEvent.touchCancel(list); fireEvent.touchEnd(list);
  page.rerender(<Harness refresh={refresh} loading/>);
  fireEvent.touchStart(list, { touches: touch(20, 20) }); fireEvent.touchMove(list, { touches: touch(20, 180) }); fireEvent.touchEnd(list);
  expect(refresh).not.toHaveBeenCalled();
});
