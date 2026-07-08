import { describe, expect, it } from "vitest";
import { groupChangesIntoCommits } from "@/lib/admin/admin-test-change-history";
import type { AdminTestChangeLogItem } from "@/lib/admin/admin-tests-types";

function makeItem(
  changedAt: string,
  questionId: number,
  revision: number,
): AdminTestChangeLogItem {
  return {
    id: String(revision),
    testId: "test-1",
    questionId,
    changeKey: `test-1#${questionId}`,
    eventType: "question_updated",
    actor: { userId: 1, fullName: "Иванов" },
    changedAt,
    revision,
    before: null,
    after: { text: "after" },
    diff: { fieldChanges: { text: { before: "before", after: "after" } } },
    context: { source: "update_test" },
  };
}

describe("groupChangesIntoCommits", () => {
  it("groups events with the same timestamp and actor into one commit", () => {
    const commits = groupChangesIntoCommits([
      makeItem("2026-07-08T10:00:00.000Z", 1, 2),
      makeItem("2026-07-08T10:00:00.000Z", 2, 3),
      makeItem("2026-07-08T09:00:00.000Z", 1, 1),
    ]);

    expect(commits).toHaveLength(2);
    expect(commits[0]?.events).toHaveLength(2);
    expect(commits[1]?.events).toHaveLength(1);
  });
});
