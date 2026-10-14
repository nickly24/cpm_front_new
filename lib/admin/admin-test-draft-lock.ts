import type { AdminTestDraft } from "@/lib/admin/admin-test-drafts-types";

function editableSnapshot(draft: AdminTestDraft) {
  return JSON.stringify({title:draft.title,description:draft.description,direction:draft.direction,startDate:draft.startDate,endDate:draft.endDate,timeLimitMinutes:draft.timeLimitMinutes,published:draft.published,visible:draft.visible,canvas:draft.canvas});
}
/** A delayed lock acknowledgement must not replace edits entered while it was pending. */
export function mergeDraftLockAcknowledgement(current:AdminTestDraft,requested:AdminTestDraft,acknowledged:AdminTestDraft):AdminTestDraft {
  if(editableSnapshot(current)===editableSnapshot(requested))return {...current,...acknowledged};
  return {...current,expectedRevision:acknowledged.expectedRevision,lockedBy:acknowledged.lockedBy,lockedByRole:acknowledged.lockedByRole,lockedByName:acknowledged.lockedByName,lockedUntil:acknowledged.lockedUntil};
}
