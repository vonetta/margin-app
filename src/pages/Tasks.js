import React, { useState, useEffect, useCallback, useMemo } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { clickableDivProps } from "../utils/a11y";

const FALLBACK_COLOR = "#4a5a6a";

const REPEAT_FREQUENCIES = [
  { value: "", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const emptyForm = {
  title: "",
  description: "",
  dueDate: "",
  assignedTo: "",
  repeatFreq: "",
  repeatInterval: 1,
};

const buildTaskRecurrenceRule = (freq, interval) => {
  if (!freq) return null;
  const parts = [`FREQ=${freq}`];
  if (interval && interval > 1) parts.push(`INTERVAL=${interval}`);
  return parts.join(";");
};

// Inverse of buildTaskRecurrenceRule — pulls FREQ/INTERVAL back out of a
// stored rule string so the edit form can be pre-filled with a task's
// current recurrence instead of always opening blank.
const parseTaskRecurrenceRule = (rule) => {
  if (!rule) return { repeatFreq: "", repeatInterval: 1 };
  const freqMatch = rule.match(/FREQ=(\w+)/);
  const intervalMatch = rule.match(/INTERVAL=(\d+)/);
  return {
    repeatFreq: freqMatch ? freqMatch[1] : "",
    repeatInterval: intervalMatch ? Number(intervalMatch[1]) : 1,
  };
};

const toDateInputValue = (dateStr) => (dateStr ? new Date(dateStr).toISOString().slice(0, 10) : "");

const describeRecurrence = (rule) => {
  if (!rule) return null;
  if (rule.includes("FREQ=DAILY")) return "↻ Daily";
  if (rule.includes("FREQ=WEEKLY")) return "↻ Weekly";
  if (rule.includes("FREQ=MONTHLY")) return "↻ Monthly";
  return "↻ Recurring";
};

const formatDue = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const overdue = d < new Date(new Date().toDateString());
  return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), overdue };
};

const Tasks = () => {
  const { user, ministryId } = useAuth();
  const memberships = useMemo(() => user?.ministries || [], [user]);
  const colorFor = useCallback(
    (mId) => memberships.find((m) => m.ministry_id === mId)?.color || FALLBACK_COLOR,
    [memberships],
  );
  const nameFor = useCallback(
    (mId) => memberships.find((m) => m.ministry_id === mId)?.name || mId,
    [memberships],
  );

  const currentRole = memberships.find((m) => m.ministry_id === ministryId)?.role;
  const canSeeEveryonesTasks = currentRole === "admin" || currentRole === "leader";

  const [tab, setTab] = useState("mine");
  const [myTasks, setMyTasks] = useState([]);
  const [assignedByMe, setAssignedByMe] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [showDone, setShowDone] = useState(false);
  const [team, setTeam] = useState([]);
  const [teamOverview, setTeamOverview] = useState({});
  const [teamOverviewStatus, setTeamOverviewStatus] = useState("open");
  const [teamOverviewLoading, setTeamOverviewLoading] = useState(false);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchTasks = useCallback(
    async (mine) => {
      if (memberships.length === 0) return [];
      const results = await Promise.all(
        memberships.map((m) =>
          client
            .get("/api/tasks", {
              params: mine === false ? { mine: "false" } : undefined,
              headers: { "x-ministry-id": m.ministry_id },
            })
            .then((res) => res.data.map((t) => ({ ...t, ministry_id: m.ministry_id })))
            .catch(() => []),
        ),
      );
      return results.flat();
    },
    [memberships],
  );

  const refreshMine = useCallback(async () => {
    setMyTasks(await fetchTasks(true));
  }, [fetchTasks]);

  const refreshAssignedByMe = useCallback(async () => {
    setAssignedByMe(await fetchTasks(false));
  }, [fetchTasks]);

  // The only thing currently auto-surfaced as "needs your action" is a
  // pending calendar event from a generated flyer — there's no other
  // approval-style workflow in the app yet. Only ministries where this
  // user is admin/leader can approve, so only those memberships are
  // queried.
  const fetchApprovals = useCallback(async () => {
    const adminMemberships = memberships.filter((m) => m.role === "admin" || m.role === "leader");
    if (adminMemberships.length === 0) {
      setApprovals([]);
      return;
    }
    const results = await Promise.all(
      adminMemberships.map((m) =>
        client
          .get("/api/events", {
            params: { status: "pending" },
            headers: { "x-ministry-id": m.ministry_id },
          })
          .then((res) => res.data.map((e) => ({ ...e, ministry_id: m.ministry_id })))
          .catch(() => []),
      ),
    );
    setApprovals(results.flat());
  }, [memberships]);

  useEffect(() => {
    refreshMine();
  }, [refreshMine]);

  useEffect(() => {
    if (tab === "assigned") refreshAssignedByMe();
  }, [tab, refreshAssignedByMe]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // "Everyone's tasks" is admin/leader only (the backend gates it the
  // same way), and only ever reflects the currently active ministry —
  // unlike "My tasks", it doesn't aggregate across memberships, since
  // "everyone" only makes sense scoped to one ministry at a time.
  const fetchTeamOverview = useCallback(async () => {
    if (!canSeeEveryonesTasks) return;
    setTeamOverviewLoading(true);
    try {
      const res = await client.get("/api/tasks/team-overview", {
        params: { status: teamOverviewStatus },
      });
      // Keyed by user id (not name) — a board column's key doubles as
      // the real assigned_to value for drag-to-reassign.
      const tagged = Object.fromEntries(
        Object.entries(res.data || {}).map(([userId, { name, tasks }]) => [
          userId,
          { name, tasks: tasks.map((t) => ({ ...t, ministry_id: ministryId })) },
        ]),
      );
      setTeamOverview(tagged);
    } catch (err) {
      setTeamOverview({});
    } finally {
      setTeamOverviewLoading(false);
    }
  }, [canSeeEveryonesTasks, teamOverviewStatus, ministryId]);

  useEffect(() => {
    if (tab === "everyone") fetchTeamOverview();
  }, [tab, fetchTeamOverview]);

  useEffect(() => {
    client
      .get("/api/ministry/team")
      .then((res) => setTeam(res.data || []))
      .catch(() => setTeam([]));
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setError("");
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.assignedTo) {
      setError("Title and an assignee are required");
      return;
    }
    if (form.repeatFreq && !form.dueDate) {
      setError("A recurring task needs a due date to anchor the recurrence");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await client.post("/api/tasks", {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        due_date: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        assigned_to: form.assignedTo,
        recurrence_rule: buildTaskRecurrenceRule(form.repeatFreq, form.repeatInterval) || undefined,
      });
      resetForm();
      await Promise.all([refreshMine(), refreshAssignedByMe(), fetchTeamOverview()]);
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (task) => {
    setEditingTaskId(task._id);
    setEditForm({
      title: task.title,
      description: task.description || "",
      dueDate: toDateInputValue(task.due_date),
      assignedTo: task.assigned_to,
      ...parseTaskRecurrenceRule(task.recurrence_rule),
    });
    setError("");
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditForm(emptyForm);
  };

  const handleSaveEdit = async (task) => {
    if (!editForm.title.trim() || !editForm.assignedTo) {
      setError("Title and an assignee are required");
      return;
    }
    if (editForm.repeatFreq && !editForm.dueDate) {
      setError("A recurring task needs a due date to anchor the recurrence");
      return;
    }
    setEditSaving(true);
    setError("");
    try {
      await client.put(
        `/api/tasks/${task._id}`,
        {
          title: editForm.title.trim(),
          description: editForm.description.trim() || undefined,
          due_date: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : undefined,
          assigned_to: editForm.assignedTo,
          recurrence_rule: buildTaskRecurrenceRule(editForm.repeatFreq, editForm.repeatInterval) || undefined,
        },
        { headers: { "x-ministry-id": task.ministry_id } },
      );
      cancelEdit();
      await Promise.all([refreshMine(), refreshAssignedByMe(), fetchTeamOverview()]);
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || "Failed to save changes");
    } finally {
      setEditSaving(false);
    }
  };

  const handleComplete = async (task) => {
    try {
      await client.put(`/api/tasks/${task._id}/complete`, null, {
        headers: { "x-ministry-id": task.ministry_id },
      });
      await Promise.all([refreshMine(), refreshAssignedByMe(), fetchTeamOverview()]);
    } catch (err) {
      setError("Failed to complete task");
    }
  };

  const handleReopen = async (task) => {
    try {
      await client.put(`/api/tasks/${task._id}/reopen`, null, {
        headers: { "x-ministry-id": task.ministry_id },
      });
      await Promise.all([refreshMine(), refreshAssignedByMe(), fetchTeamOverview()]);
    } catch (err) {
      setError("Failed to reopen task");
    }
  };

  const handleDelete = async (task) => {
    try {
      await client.delete(`/api/tasks/${task._id}`, {
        headers: { "x-ministry-id": task.ministry_id },
      });
      setConfirmDeleteId(null);
      if (editingTaskId === task._id) cancelEdit();
      await Promise.all([refreshMine(), refreshAssignedByMe(), fetchTeamOverview()]);
    } catch (err) {
      setError("Failed to delete task");
    }
  };

  const visibleMine = myTasks.filter((t) => (showDone ? true : t.status === "open"));
  const openCount = myTasks.filter((t) => t.status === "open").length;

  // Dropping a card onto a person column reassigns it (reopening first if
  // it came from Done); dropping onto Done completes it. A no-op drop
  // (same column, already in that state) skips the network call.
  const handleBoardDrop = async (task, targetKey) => {
    setDragOverColumn(null);
    try {
      if (targetKey === "done") {
        if (task.status !== "done") {
          await client.put(`/api/tasks/${task._id}/complete`, null, {
            headers: { "x-ministry-id": task.ministry_id },
          });
        }
      } else {
        if (task.status === "done") {
          await client.put(`/api/tasks/${task._id}/reopen`, null, {
            headers: { "x-ministry-id": task.ministry_id },
          });
        }
        if (task.assigned_to !== targetKey) {
          await client.put(
            `/api/tasks/${task._id}`,
            { assigned_to: targetKey },
            { headers: { "x-ministry-id": task.ministry_id } },
          );
        }
      }
      await fetchTeamOverview();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update this task");
    }
  };

  const renderEditForm = (task) => (
    <div
      key={task._id}
      style={{
        background: "var(--white)",
        border: "1px solid var(--navy)",
        borderRadius: "var(--border-radius-lg)",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <input
        type="text"
        placeholder="Task title"
        value={editForm.title}
        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
        style={{
          padding: "8px 12px",
          border: "0.5px solid var(--gray-300)",
          borderRadius: "var(--border-radius)",
          fontSize: "13px",
        }}
      />
      <textarea
        placeholder="Description (optional)"
        value={editForm.description}
        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
        rows={2}
        style={{
          padding: "8px 12px",
          border: "0.5px solid var(--gray-300)",
          borderRadius: "var(--border-radius)",
          fontSize: "13px",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <select
          value={editForm.assignedTo}
          onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })}
          style={{
            padding: "8px 12px",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius)",
            fontSize: "13px",
            flex: 1,
            minWidth: "180px",
          }}
        >
          <option value="">Assign to...</option>
          {team.map((member) => (
            <option key={member._id} value={member._id}>
              {member.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={editForm.dueDate}
          onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
          style={{
            padding: "8px 12px",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius)",
            fontSize: "13px",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <select
          value={editForm.repeatFreq}
          onChange={(e) => setEditForm({ ...editForm, repeatFreq: e.target.value })}
          style={{
            padding: "6px 10px",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius)",
            fontSize: "12px",
          }}
        >
          {REPEAT_FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        {editForm.repeatFreq && (
          <>
            <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>every</span>
            <input
              type="number"
              min={1}
              value={editForm.repeatInterval}
              onChange={(e) => setEditForm({ ...editForm, repeatInterval: Number(e.target.value) || 1 })}
              style={{
                width: "50px",
                padding: "6px 8px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
              }}
            />
            <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>
              {editForm.repeatFreq === "DAILY" ? "day(s)" : editForm.repeatFreq === "WEEKLY" ? "week(s)" : "month(s)"}
            </span>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => handleSaveEdit(task)}
          disabled={editSaving}
          style={{
            padding: "6px 14px",
            background: "var(--navy)",
            color: "var(--white)",
            border: "none",
            borderRadius: "var(--border-radius)",
            fontSize: "12px",
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          {editSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={cancelEdit}
          style={{
            padding: "6px 14px",
            background: "transparent",
            color: "var(--gray-600)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius)",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderTask = (task, { showAssignee } = {}) => {
    if (editingTaskId === task._id) return renderEditForm(task);

    const due = formatDue(task.due_date);
    return (
      <div
        key={task._id}
        style={{
          background: "var(--white)",
          border: "0.5px solid var(--gray-300)",
          borderLeft: `3px solid ${colorFor(task.ministry_id)}`,
          borderRadius: "var(--border-radius-lg)",
          padding: "14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          opacity: task.status === "done" ? 0.6 : 1,
        }}
      >
        <div
          {...clickableDivProps(() => startEdit(task))}
          style={{ cursor: "pointer", flex: 1 }}
          title="Click to view and edit details"
        >
          {memberships.length > 1 && (
            <div style={{ fontSize: "9px", color: colorFor(task.ministry_id), fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
              {nameFor(task.ministry_id)}
            </div>
          )}
          <div
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--charcoal)",
              textDecoration: task.status === "done" ? "line-through" : "none",
            }}
          >
            {task.title}
          </div>
          {task.description && (
            <div style={{ fontSize: "11px", color: "var(--gray-600)", marginTop: "4px" }}>{task.description}</div>
          )}
          <div style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "4px" }}>
            {due && (
              <span style={{ color: due.overdue && task.status === "open" ? "#c0504d" : "var(--gray-500)" }}>
                Due {due.label}
              </span>
            )}
            {task.recurrence_rule && <span>{due ? " · " : ""}{describeRecurrence(task.recurrence_rule)}</span>}
            {showAssignee && (
              <span>{due || task.recurrence_rule ? " · " : ""}{team.find((m) => m._id === task.assigned_to)?.name || "Someone"}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button
            onClick={() => startEdit(task)}
            style={{
              padding: "5px 10px",
              background: "transparent",
              color: "var(--navy)",
              border: "0.5px solid var(--navy)",
              borderRadius: "var(--border-radius)",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Edit
          </button>
          {task.status === "open" ? (
            <button
              onClick={() => handleComplete(task)}
              style={{
                padding: "5px 10px",
                background: "var(--navy)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              ✓ Done
            </button>
          ) : (
            <button
              onClick={() => handleReopen(task)}
              style={{
                padding: "5px 10px",
                background: "transparent",
                color: "var(--gray-600)",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Reopen
            </button>
          )}
          {confirmDeleteId === task._id ? (
            <>
              <button
                onClick={() => handleDelete(task)}
                style={{
                  padding: "5px 10px",
                  background: "#c0504d",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                style={{
                  padding: "5px 10px",
                  background: "transparent",
                  color: "var(--gray-600)",
                  border: "0.5px solid var(--gray-300)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDeleteId(task._id)}
              style={{
                padding: "5px 10px",
                background: "transparent",
                color: "#c0504d",
                border: "0.5px solid #e8b4b4",
                borderRadius: "var(--border-radius)",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <PageHeader
        icon="☑"
        color="var(--accent)"
        title="Tasks"
        subtitle="What you and your team need to get done, across every ministry you're part of"
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            style={{
              padding: "8px 16px",
              background: "var(--navy)",
              color: "var(--white)",
              border: "none",
              borderRadius: "var(--border-radius)",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            {showForm ? "Cancel" : "+ New task"}
          </button>
        }
      />

      <div style={{ display: "flex", gap: "4px", marginBottom: "20px" }}>
        {[
          { key: "mine", label: `My tasks${openCount ? ` (${openCount})` : ""}` },
          { key: "assigned", label: "Assigned by me" },
          { key: "approvals", label: `Needs approval${approvals.length ? ` (${approvals.length})` : ""}` },
          ...(canSeeEveryonesTasks ? [{ key: "everyone", label: "Everyone's tasks" }] : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              border: "0.5px solid var(--gray-300)",
              background: tab === t.key ? "var(--navy)" : "transparent",
              color: tab === t.key ? "var(--white)" : "var(--charcoal)",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            background: "#fdf0f0",
            border: "0.5px solid #e8b4b4",
            borderRadius: "var(--border-radius)",
            padding: "10px 12px",
            fontSize: "12px",
            color: "#c0504d",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {showForm && (
        <div
          style={{
            background: "var(--white)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius-lg)",
            padding: "20px",
            marginBottom: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {memberships.length > 1 && (
            <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
              Creating in: <span style={{ fontWeight: "600", color: colorFor(ministryId) }}>{nameFor(ministryId)}</span>
              {" — switch ministries from the sidebar to assign within a different one"}
            </div>
          )}
          <input
            type="text"
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={{
              padding: "8px 12px",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius)",
              fontSize: "13px",
            }}
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            style={{
              padding: "8px 12px",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius)",
              fontSize: "13px",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              style={{
                padding: "8px 12px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "13px",
                flex: 1,
                minWidth: "180px",
              }}
            >
              <option value="">Assign to...</option>
              {team.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              style={{
                padding: "8px 12px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "13px",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              value={form.repeatFreq}
              onChange={(e) => setForm({ ...form, repeatFreq: e.target.value })}
              style={{
                padding: "6px 10px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
              }}
            >
              {REPEAT_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            {form.repeatFreq && (
              <>
                <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>every</span>
                <input
                  type="number"
                  min={1}
                  value={form.repeatInterval}
                  onChange={(e) => setForm({ ...form, repeatInterval: Number(e.target.value) || 1 })}
                  style={{
                    width: "50px",
                    padding: "6px 8px",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                  }}
                />
                <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                  {form.repeatFreq === "DAILY" ? "day(s)" : form.repeatFreq === "WEEKLY" ? "week(s)" : "month(s)"}
                </span>
              </>
            )}
          </div>
          <div>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                padding: "8px 16px",
                background: "var(--navy)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving..." : "Assign task"}
            </button>
          </div>
        </div>
      )}

      {tab === "mine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label style={{ fontSize: "11px", color: "var(--gray-500)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show completed
          </label>
          {visibleMine.length === 0 && (
            <div
              style={{
                background: "var(--white)",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius-lg)",
                padding: "32px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--gray-500)",
              }}
            >
              Nothing assigned to you right now.
            </div>
          )}
          {visibleMine.map((t) => renderTask(t))}
        </div>
      )}

      {tab === "assigned" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {assignedByMe.length === 0 && (
            <div
              style={{
                background: "var(--white)",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius-lg)",
                padding: "32px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--gray-500)",
              }}
            >
              You haven't assigned any tasks yet.
            </div>
          )}
          {assignedByMe.map((t) => renderTask(t, { showAssignee: true }))}
        </div>
      )}

      {tab === "approvals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {approvals.length === 0 && (
            <div
              style={{
                background: "var(--white)",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius-lg)",
                padding: "32px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--gray-500)",
              }}
            >
              Nothing waiting on you. Events auto-created from generated flyers show up here until you approve or reject
              them on the Calendar page.
            </div>
          )}
          {approvals.map((event) => (
            <div
              key={event._id}
              style={{
                background: "var(--white)",
                border: "0.5px solid var(--gray-300)",
                borderLeft: `3px solid ${colorFor(event.ministry_id)}`,
                borderRadius: "var(--border-radius-lg)",
                padding: "14px",
              }}
            >
              {memberships.length > 1 && (
                <div style={{ fontSize: "9px", color: colorFor(event.ministry_id), fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
                  {nameFor(event.ministry_id)}
                </div>
              )}
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--charcoal)" }}>{event.title}</div>
              <div style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "4px" }}>
                Calendar event awaiting approval — review it on the Calendar page
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "everyone" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { key: "open", label: "Open" },
              { key: "all", label: "Open + completed" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setTeamOverviewStatus(s.key)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "14px",
                  border: "0.5px solid var(--gray-300)",
                  background: teamOverviewStatus === s.key ? "var(--gray-200)" : "transparent",
                  color: "var(--charcoal)",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {teamOverviewLoading && (
            <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
          )}

          {!teamOverviewLoading && Object.keys(teamOverview).length === 0 && (
            <div
              style={{
                background: "var(--white)",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius-lg)",
                padding: "32px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--gray-500)",
              }}
            >
              No tasks to show.
            </div>
          )}

          {Object.keys(teamOverview).length > 0 && (() => {
            // Drag-and-drop alone fails WCAG 2.2 SC 2.5.7 (Dragging
            // Movements) — every card also needs a way to reassign/
            // complete it without dragging. These real <select>/<button>
            // elements are that alternative, not just a decoration.
            const personOptions = Object.entries(teamOverview).map(([id, { name }]) => ({ id, name }));
            return (
            <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" }}>
              {Object.entries(teamOverview).map(([userId, { name, tasks }]) => {
                const activeTasks = tasks.filter((t) => t.status !== "done");
                return (
                  <div
                    key={userId}
                    data-testid={`board-column-${userId}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverColumn(userId);
                    }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedTask) handleBoardDrop(draggedTask, userId);
                    }}
                    style={{
                      minWidth: "240px",
                      width: "240px",
                      flexShrink: 0,
                      background: dragOverColumn === userId ? "var(--gray-200)" : "var(--gray-100)",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius-lg)",
                      padding: "12px",
                      transition: "background 0.1s",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "var(--gray-600)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: "10px",
                      }}
                    >
                      {name} <span style={{ fontWeight: "400", color: "var(--gray-600)" }}>({activeTasks.length})</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {activeTasks.map((t) => {
                        const due = formatDue(t.due_date);
                        return (
                          <div
                            key={t._id}
                            draggable
                            onDragStart={() => setDraggedTask(t)}
                            onDragEnd={() => setDraggedTask(null)}
                            style={{
                              background: "var(--white)",
                              border: "0.5px solid var(--gray-300)",
                              borderRadius: "var(--border-radius)",
                              padding: "10px",
                              boxShadow: "var(--shadow)",
                              cursor: "grab",
                            }}
                          >
                            <div style={{ fontSize: "12px", color: "var(--charcoal)" }}>{t.title}</div>
                            {due && (
                              <div
                                style={{
                                  marginTop: "6px",
                                  display: "inline-block",
                                  fontSize: "9px",
                                  fontWeight: "600",
                                  padding: "2px 6px",
                                  borderRadius: "10px",
                                  color: due.overdue ? "#c0504d" : "var(--gray-600)",
                                  background: due.overdue ? "#fdf0f0" : "var(--gray-200)",
                                }}
                              >
                                {due.label}
                              </div>
                            )}
                            <div style={{ display: "flex", gap: "6px", marginTop: "8px", alignItems: "center" }}>
                              <select
                                aria-label={`Reassign "${t.title}"`}
                                value={userId}
                                onChange={(e) => handleBoardDrop(t, e.target.value)}
                                style={{
                                  flex: 1,
                                  fontSize: "10px",
                                  padding: "3px 4px",
                                  border: "0.5px solid var(--gray-300)",
                                  borderRadius: "6px",
                                  color: "var(--gray-600)",
                                  background: "var(--white)",
                                }}
                              >
                                {personOptions.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                aria-label={`Mark "${t.title}" done`}
                                onClick={() => handleBoardDrop(t, "done")}
                                style={{
                                  fontSize: "10px",
                                  padding: "3px 8px",
                                  border: "0.5px solid #b4d8b4",
                                  borderRadius: "6px",
                                  background: "transparent",
                                  color: "#3a7a4a",
                                  cursor: "pointer",
                                }}
                              >
                                ✓ Done
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {activeTasks.length === 0 && (
                        <div style={{ fontSize: "11px", color: "var(--gray-600)", fontStyle: "italic" }}>
                          Nothing here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {(() => {
                const doneTasks = Object.values(teamOverview).flatMap(({ name, tasks }) =>
                  tasks.filter((t) => t.status === "done").map((t) => ({ ...t, assigneeName: name })),
                );
                return (
                  <div
                    data-testid="board-column-done"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverColumn("done");
                    }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedTask) handleBoardDrop(draggedTask, "done");
                    }}
                    style={{
                      minWidth: "240px",
                      width: "240px",
                      flexShrink: 0,
                      background: dragOverColumn === "done" ? "var(--gray-200)" : "#f1f7f2",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius-lg)",
                      padding: "12px",
                      transition: "background 0.1s",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "#3a7a4a",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: "10px",
                      }}
                    >
                      ✓ Done <span style={{ fontWeight: "400", color: "var(--gray-600)" }}>({doneTasks.length})</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {doneTasks.map((t) => (
                        <div
                          key={t._id}
                          draggable
                          onDragStart={() => setDraggedTask(t)}
                          onDragEnd={() => setDraggedTask(null)}
                          style={{
                            background: "var(--white)",
                            border: "0.5px solid var(--gray-300)",
                            borderRadius: "var(--border-radius)",
                            padding: "10px",
                            boxShadow: "var(--shadow)",
                            cursor: "grab",
                          }}
                        >
                          <div style={{ fontSize: "12px", color: "var(--gray-600)", textDecoration: "line-through" }}>
                            {t.title}
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "4px" }}>
                            {t.assigneeName}
                          </div>
                          <div style={{ display: "flex", gap: "6px", marginTop: "8px", alignItems: "center" }}>
                            <select
                              aria-label={`Reassign "${t.title}"`}
                              value={t.assigned_to}
                              onChange={(e) => handleBoardDrop(t, e.target.value)}
                              style={{
                                flex: 1,
                                fontSize: "10px",
                                padding: "3px 4px",
                                border: "0.5px solid var(--gray-300)",
                                borderRadius: "6px",
                                color: "var(--gray-600)",
                                background: "var(--white)",
                              }}
                            >
                              {personOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              aria-label={`Reopen "${t.title}"`}
                              onClick={() => handleBoardDrop(t, t.assigned_to)}
                              style={{
                                fontSize: "10px",
                                padding: "3px 8px",
                                border: "0.5px solid var(--gray-300)",
                                borderRadius: "6px",
                                background: "transparent",
                                color: "var(--gray-600)",
                                cursor: "pointer",
                              }}
                            >
                              ↺ Reopen
                            </button>
                          </div>
                        </div>
                      ))}
                      {doneTasks.length === 0 && (
                        <div style={{ fontSize: "11px", color: "var(--gray-600)", fontStyle: "italic" }}>
                          Drag a task here to complete it
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default Tasks;
