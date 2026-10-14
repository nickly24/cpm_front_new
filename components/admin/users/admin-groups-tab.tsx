"use client";

import { CoreEditOnly, CoreReadOnlyControl } from "@/components/admin/users/core-access";

import { AdminGroupFormPanel } from "@/components/admin/users/admin-group-form-panel";
import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import { coreCan } from "@/lib/bff/core-admin";
import { useAuth } from "@/contexts/AuthContext";
import { BFF_DEV } from "@/lib/config";
import { CoreCreateRecovery } from "@/components/admin/users/core-access";
import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  assignAdminProctorToGroup,
  assignAdminStudentToGroup,
  createAdminGroup,
  deleteAdminGroup,
  fetchAdminGroupMembers,
  fetchAdminGroupsList,
  fetchAdminGroupsOverview,
  fetchAdminUnsignedUsers,
  removeAdminProctorFromGroup,
  removeAdminStudentFromGroup,
  updateAdminGroup,
} from "@/lib/admin/admin-users-api";
import type { AdminGroupOverviewRow } from "@/lib/admin/admin-users-types";
import { toClientPagination } from "@/lib/admin/admin-users-utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 12;

function proctorName(row: AdminGroupOverviewRow): string {
  if (row.proctor.status && row.proctor.res && typeof row.proctor.res === "object") {
    return row.proctor.res.full_name;
  }
  return "Не назначен";
}

export function AdminGroupsTab() {
  const {user}=useAuth();
  const canSeeDirectory=!BFF_DEV||coreCan("users",false,user);
  const loadSerial=useRef(0);
  const [rows, setRows] = useState<AdminGroupOverviewRow[]>([]);
  const [groupsList, setGroupsList] = useState<{ group_id: number; group_name: string }[]>([]);
  const [unsigned, setUnsigned] = useState({
    students: 0,
    proctors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [movingAccountId,setMovingAccountId]=useState<number|null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [expandedMembers, setExpandedMembers] = useState<
    Record<number, { students: { id: number; full_name: string; class?: number; school_name?: string | null }[]; proctor: AdminGroupOverviewRow["proctor"] }>
  >({});
  const [groupForm, setGroupForm] = useState<
    { mode: "create" } | { mode: "edit"; groupId: number; name: string } | null
  >(null);

  const load = useCallback(async () => {
    const serial=++loadSerial.current;
    setLoading(true);
    setError(null);
    try {
      const [overview, groups, unsignedData] = await Promise.all([
        fetchAdminGroupsOverview({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch,
        }),
        fetchAdminGroupsList(),
        fetchAdminUnsignedUsers(),
      ]);
      if(serial!==loadSerial.current)return;
      if (!overview.status) {
        throw new Error(overview.error || "Не удалось загрузить группы");
      }
      setRows(overview.res);
      setTotal(overview.total);
      setGroupsList(groups);
      setUnsigned({
        students: unsignedData.unassigned_students?.length ?? 0,
        proctors: unsignedData.unassigned_proctors?.length ?? 0,
      });
    } catch (err) {
      if(serial!==loadSerial.current)return;
      setRows([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      if(serial===loadSerial.current)setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    queueMicrotask(()=>{void load();});
  }, [load]);

  const pagination = toClientPagination(page, PAGE_SIZE, total);

  const toggleExpand = async (groupId: number) => {
    if (expandedId === groupId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(groupId);
    if (expandedMembers[groupId]) {
      return;
    }
    setExpandedLoading(true);
    try {
      const data = await fetchAdminGroupMembers(groupId);
      if (!data.status) {
        throw new Error(data.error || "Не удалось загрузить состав");
      }
      setExpandedMembers((prev) => ({
        ...prev,
        [groupId]: {
          students: data.students,
          proctor: data.proctor,
        },
      }));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка загрузки состава");
      setExpandedId(null);
    } finally {
      setExpandedLoading(false);
    }
  };

  const refreshExpanded = async (groupId: number) => {
    const data = await fetchAdminGroupMembers(groupId);
    if (data.status) {
      setExpandedMembers((prev) => ({
        ...prev,
        [groupId]: {
          students: data.students,
          proctor: data.proctor,
        },
      }));
    }
    await load();
  };

  const handleRemoveStudent = async (groupId: number, studentId: number) => {
    try {
      await removeAdminStudentFromGroup(studentId,groupId);
      await refreshExpanded(groupId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const handleRemoveProctor = async (groupId: number, proctorId: number) => {
    try {
      await removeAdminProctorFromGroup(proctorId,groupId);
      await refreshExpanded(groupId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const handleMoveMember = async (groupId:number,accountId:number,targetGroupId:number,role:"student"|"proctor") => {
    if(targetGroupId===groupId)return;
    setMovingAccountId(accountId);
    try {
      if(role==="student")await assignAdminStudentToGroup(accountId,targetGroupId);
      else await assignAdminProctorToGroup(accountId,targetGroupId);
      setExpandedMembers(previous=>{const next={...previous};delete next[targetGroupId];return next;});
      await refreshExpanded(groupId);
    } catch(error){window.alert(error instanceof Error?error.message:"Ошибка смены группы");}
    finally{setMovingAccountId(null);}
  };

  const handleDeleteGroup = async (row: AdminGroupOverviewRow) => {
    const message = [
      `${BFF_DEV ? "Архивировать" : "Удалить"} группу «${row.item.group_name}»?`,
      "",
      `Учеников в группе: ${row.student_count}.`,
      proctorName(row) !== "Не назначен"
        ? `Проктор: ${proctorName(row)}.`
        : null,
      "",
      "Все ученики и проктор будут отвязаны от группы.",
    ]
      .filter(Boolean)
      .join("\n");

    if (!window.confirm(message)) {
      return;
    }

    try {
      const res = await deleteAdminGroup(row.item.group_id);
      if (!res.status) {
        throw new Error(res.error || "Не удалось архивировать группу");
      }
      if (expandedId === row.item.group_id) {
        setExpandedId(null);
      }
      setExpandedMembers((prev) => {
        const next = { ...prev };
        delete next[row.item.group_id];
        return next;
      });
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  return (
    <>
      <CoreCreateRecovery onRecovered={load} />
      {groupForm ? (
        <AdminGroupFormPanel
          mode={groupForm.mode}
          initialName={groupForm.mode === "edit" ? groupForm.name : ""}
          onClose={() => {setGroupForm(null);void load();}}
          onSubmit={async (name) => {
            if (groupForm.mode === "create") {
              const res = await createAdminGroup(name);
              if (!res.status) {
                throw new Error(res.error || "Не удалось создать группу");
              }
            } else {
              const res = await updateAdminGroup(groupForm.groupId, name);
              if (!res.status) {
                throw new Error(res.error || "Не удалось переименовать группу");
              }
            }
            await load();
          }}
        />
      ) : null}

      <div className={styles.listToolbar}>
        <div className={userStyles.statsRow}>
          <span className={userStyles.statPill}>
            Групп: <strong>{total}</strong>
          </span>
          {canSeeDirectory ? <><span className={userStyles.statPill}>
            Без группы — учеников: <strong>{unsigned.students}</strong>
          </span>
          <span className={userStyles.statPill}>
            прокторов: <strong>{unsigned.proctors}</strong>
          </span></> : <span className={userStyles.hint}>Просмотр пользователей без группы недоступен для этой роли.</span>}
        </div>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Поиск группы по названию или ID…"
          aria-label="Поиск групп"
          value={search}
          onChange={(e) => {setSearch(e.target.value);setPage(1);}}
        />
        <div className={styles.toolbarActions}><CoreEditOnly section="groups"><Button type="button" onClick={() => setGroupForm({ mode: "create" })}>
          + Создать группу
        </Button></CoreEditOnly></div>
      </div>

      {error ? <div className={styles.stateBox}>{error}</div> : null}

      {loading ? (
        <LoadingState label="Загрузка групп…" variant="block" className={styles.stateBox} />
      ) : rows.length === 0 ? (
        <div className={styles.stateBox}>
          <p>Группы не найдены</p>
          <CoreEditOnly section="groups"><Button type="button" onClick={() => setGroupForm({ mode: "create" })}>
            + Создать группу
          </Button></CoreEditOnly>
        </div>
      ) : (
        <>
          <div className={styles.cardsGrid}>
            {rows.map((row) => {
              const groupId = row.item.group_id;
              const expanded = expandedId === groupId;
              const members = expandedMembers[groupId];

              return (
                <article key={groupId} className={styles.card}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>{row.item.group_name}</h3>
                    <span className={userStyles.metaTag}>ID {groupId}</span>
                  </div>

                  <dl className={styles.infoList}>
                    <div className={styles.infoRow}>
                      <dt>Учеников</dt>
                      <dd className={styles.infoValue}>{row.student_count}</dd>
                    </div>
                    <div className={styles.infoRow}>
                      <dt>Проктор</dt>
                      <dd className={styles.infoValue}>{proctorName(row)}</dd>
                    </div>
                  </dl>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                      onClick={() => toggleExpand(groupId)}
                    >
                      {expanded ? "Свернуть" : "Состав"}
                    </button>
                    <CoreEditOnly section="groups"><button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() =>
                        setGroupForm({
                          mode: "edit",
                          groupId,
                          name: row.item.group_name,
                        })
                      }
                    >
                      Переименовать
                    </button></CoreEditOnly>
                    <CoreEditOnly section="groups"><button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => handleDeleteGroup(row)}
                    >
                      {BFF_DEV ? "Архивировать" : "Удалить"}
                    </button></CoreEditOnly>
                  </div>

                  {expanded ? (
                    <div className={userStyles.expandPanel}>
                      {expandedLoading && !members ? (
                        <LoadingState label="Загрузка состава…" variant="block" />
                      ) : members ? (
                        <>
                          <div style={{ marginBottom: 12 }}>
                            <div className={userStyles.memberMeta}>Проктор</div>
                            {members.proctor.status &&
                            members.proctor.res &&
                            typeof members.proctor.res === "object" ? (
                              <div className={`${userStyles.memberRow} ${BFF_DEV ? userStyles.memberRowWithGroup : ""}`}>
                                <div>
                                  <div className={userStyles.memberName}>
                                    {members.proctor.res.full_name}
                                  </div>
                                </div>
                                {BFF_DEV ? <CoreEditOnly section="groups"><select className={userStyles.fieldSelect} aria-label={`Группа для ${members.proctor.res.full_name}`} value={groupId} disabled={movingAccountId!==null} onChange={event=>void handleMoveMember(groupId, members.proctor.res&&typeof members.proctor.res==="object"?members.proctor.res.proctor_id:0,Number(event.target.value),"proctor")}>{groupsList.map(group=><option key={group.group_id} value={group.group_id}>{group.group_name}</option>)}</select></CoreEditOnly> : null}
                                <CoreEditOnly section="groups"><button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                  onClick={() =>
                                    handleRemoveProctor(
                                      groupId,
                                      members.proctor.res &&
                                        typeof members.proctor.res === "object"
                                        ? members.proctor.res.proctor_id
                                        : 0,
                                    )
                                  }
                                >
                                  Снять
                                </button></CoreEditOnly>
                              </div>
                            ) : (
                              <p className={userStyles.hint}>Проктор не назначен</p>
                            )}
                          </div>

                          <div className={userStyles.memberMeta}>Ученики</div>
                          <div className={userStyles.memberList}>
                            {members.students.length === 0 ? (
                              <p className={userStyles.hint}>В группе нет учеников</p>
                            ) : (
                              members.students.map((student) => (
                                <div key={student.id} className={`${userStyles.memberRow} ${BFF_DEV ? userStyles.memberRowWithGroup : ""}`}>
                                  <div>
                                    <div className={userStyles.memberName}>
                                      {student.full_name}
                                    </div>
                                    <div className={userStyles.memberMeta}>
                                      {student.school_name
                                        ? `Школа: ${student.school_name}`
                                        : "Школа не указана"}
                                    </div>
                                  </div>
                                  {BFF_DEV ? <CoreEditOnly section="groups"><select className={userStyles.fieldSelect} aria-label={`Группа для ${student.full_name}`} value={groupId} disabled={movingAccountId!==null} onChange={event=>void handleMoveMember(groupId,student.id,Number(event.target.value),"student")}>{groupsList.map(group=><option key={group.group_id} value={group.group_id}>{group.group_name}</option>)}</select></CoreEditOnly> : null}
                                  <CoreEditOnly section="groups"><button
                                    type="button"
                                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                    onClick={() =>
                                      handleRemoveStudent(groupId, student.id)
                                    }
                                  >
                                    Убрать
                                  </button></CoreEditOnly>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <AdminListPaginationBar pagination={pagination} onPageChange={setPage} />

          {canSeeDirectory && unsigned.students + unsigned.proctors > 0 ? (
            <AdminUnsignedAssignBlock
              groups={groupsList}
              onAssigned={load}
            />
          ) : null}
        </>
      )}
    </>
  );
}

function AdminUnsignedAssignBlock({
  groups,
  onAssigned,
}: {
  groups: { group_id: number; group_name: string }[];
  onAssigned: () => void | Promise<void>;
}) {
  const [data, setData] = useState<{
    students: { student_id: number; full_name: string }[];
    proctors: { proctor_id: number; full_name: string }[];
  }>({ students: [], proctors: [] });
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAdminUnsignedUsers()
      .then((res) => {
        setData({
          students: res.unassigned_students ?? [],
          proctors: res.unassigned_proctors ?? [],
        });
      })
      .catch(()=>setData({students:[],proctors:[]}))
      .finally(() => setLoading(false));
  }, []);

  const assignStudent = async (studentId: number) => {
    const groupId = selection[`student_${studentId}`];
    if (!groupId) {
      return;
    }
    try {await assignAdminStudentToGroup(studentId, Number(groupId));} catch(e){window.alert(e instanceof Error?e.message:"Ошибка назначения");return;}
    setData((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.student_id !== studentId),
    }));
    await onAssigned();
  };

  const assignProctor = async (proctorId: number) => {
    const groupId = selection[`proctor_${proctorId}`];
    if (!groupId) {
      return;
    }
    try {await assignAdminProctorToGroup(proctorId, Number(groupId));} catch(e){window.alert(e instanceof Error?e.message:"Ошибка назначения");return;}
    setData((prev) => ({
      ...prev,
      proctors: prev.proctors.filter((p) => p.proctor_id !== proctorId),
    }));
    await onAssigned();
  };

  if (loading) {
    return null;
  }

  if (data.students.length === 0 && data.proctors.length === 0) {
    return null;
  }

  return (
    <div className={userStyles.expandPanel}>
      <h3 className={styles.cardTitle}>Непривязанные к группам</h3>
      <div className={userStyles.memberList}>
        {data.proctors.map((proctor) => (
          <div key={proctor.proctor_id} className={userStyles.searchResultRow}>
            <div>
              <div className={userStyles.memberName}>{proctor.full_name}</div>
              <div className={userStyles.memberMeta}>Проктор</div>
            </div>
            <div className={userStyles.tableActions}>
              <CoreReadOnlyControl section="groups"><select
                className={userStyles.fieldSelect}
                value={selection[`proctor_${proctor.proctor_id}`] ?? ""}
                onChange={(e) =>
                  setSelection((prev) => ({
                    ...prev,
                    [`proctor_${proctor.proctor_id}`]: e.target.value,
                  }))
                }
              >
                <option value="">Группа</option>
                {groups.map((g) => (
                  <option key={g.group_id} value={g.group_id}>
                    {g.group_name}
                  </option>
                ))}
              </select></CoreReadOnlyControl>
              <CoreEditOnly section="groups"><button
                type="button"
                className={styles.actionBtn}
                onClick={() => assignProctor(proctor.proctor_id)}
              >
                Назначить
              </button></CoreEditOnly>
            </div>
          </div>
        ))}
        {data.students.map((student) => (
          <div key={student.student_id} className={userStyles.searchResultRow}>
            <div>
              <div className={userStyles.memberName}>{student.full_name}</div>
              <div className={userStyles.memberMeta}>Ученик</div>
            </div>
            <div className={userStyles.tableActions}>
              <CoreReadOnlyControl section="groups"><select
                className={userStyles.fieldSelect}
                value={selection[`student_${student.student_id}`] ?? ""}
                onChange={(e) =>
                  setSelection((prev) => ({
                    ...prev,
                    [`student_${student.student_id}`]: e.target.value,
                  }))
                }
              >
                <option value="">Группа</option>
                {groups.map((g) => (
                  <option key={g.group_id} value={g.group_id}>
                    {g.group_name}
                  </option>
                ))}
              </select></CoreReadOnlyControl>
              <CoreEditOnly section="groups"><button
                type="button"
                className={styles.actionBtn}
                onClick={() => assignStudent(student.student_id)}
              >
                Назначить
              </button></CoreEditOnly>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
