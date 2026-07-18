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
  assignedTo: [],
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
  const [teamOverviewStatus, setTeamOverviewStatus] = useState("active");
  const [teamOverviewLoading, setTeamOverviewLoading] = useState(false);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [similarTasks, setSimilarTasks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [completeNotesDraft, setCompleteNotesDraft] = useState("");
  const [editingNotesTaskId, setEditingNotesTaskId] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

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

  // Debounced so this doesn't fire a request per keystroke — a nudge to
  // avoid an accidental duplicate, not a blocking check, so it stays
  // quiet (no request at all) until the title looks like a real attempt
  // at one.
  useEffect(() => {
    if (!showForm || form.title.trim().length < 4) {
      setSimilarTasks([]);
      return;
    }
    const handle = setTimeout(() => {
      client
        .get("/api/tasks/similar", { params: { title: form.title.trim() } })
        .then((res) => setSimilarTasks(res.data || []))
        .catch(() => setSimilarTasks([]));
    }, 400);
    return () => clearTimeout(handle);
  }, [showForm, form.title]);

  const resetForm = () => {
    setForm(emptyForm);
    setSimilarTasks([]);
    setError("");
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || form.assignedTo.length === 0) {
      setError("Title and at least one assignee are required");
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
    setEditingNotesTaskId(null);
    setNotesDraft("");
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

  const handleComplete = async (task, notes) => {
    try {
      await client.put(
        `/api/tasks/${task._id}/complete`,
        { notes: notes?.trim() || undefined },
        { headers: { "x-ministry-id": task.ministry_id } },
      );
      setCompletingTaskId(null);
      setCompleteNotesDraft("");
      await Promise.all([refreshMine(), refreshAssignedByMe(), fetchTeamOverview()]);
    } catch (err) {
      setError("Failed to complete task");
    }
  };

  const handleSaveNotes = async (task) => {
    setSavingNotes(true);
    setError("");
    try {
      await client.put(
        `/api/tasks/${task._id}`,
        { completion_notes: notesDraft.trim() || undefined },
        { headers: { "x-ministry-id": task.ministry_id } },
      );
      setEditingNotesTaskId(null);
      await Promise.all([refreshMine(), refreshAssignedByMe(), fetchTeamOverview()]);
    } catch (err) {
      setError("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleHold = async (task) => {
    try {
      await client.put(
        `/api/tasks/${task._id}/hold`,
        {},
        { headers: { "x-ministry-id": task.ministry_id } },
      );
      await Promise.all([refreshMine(), refreshAssignedByMe(), fetchTeamOverview()]);
    } catch (err) {
      setError("Failed to put this task on hold");
    }
  };

  // Removing a co-assignee from a shared task is just deleting their own
  // row, the same as the board's handleRemoveFromBoard — no confirmation
  // step, matching that same lower-stakes precedent (unlike deleting
  // your OWN task, which does confirm).
  const handleRemoveSibling = async (siblingTaskId, ministryId) => {
    try {
      await client.delete(`/api/tasks/${siblingTaskId}`, {
        headers: { "x-ministry-id": ministryId },
      });
      await Promise.all([refreshMine(), refreshAssignedByMe(), fetchTeamOverview()]);
    } catch (err) {
      setError("Failed to remove that person from the task");
    }
  };

  const handleAddAssignee = async (task, userId) => {
    try {
      await client.post(
        `/api/tasks/${task._id}/assignees`,
        { user_id: userId },
        { headers: { "x-ministry-id": task.ministry_id } },
      );
      await Promise.all([refreshMine(), refreshAssignedByMe(), fetchTeamOverview()]);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add that person to this task");
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

  // On-hold is still active work (blocked, not finished) — it stays
  // visible by default alongside "open," matching the "active" (open +
  // on_hold) semantic already used by the team-overview board. Only
  // "done" is hidden until the checkbox reveals it.
  const visibleMine = myTasks.filter((t) => (showDone ? true : t.status !== "done"));
  const openCount = myTasks.filter((t) => t.status === "open").length;

  // Dropping (or picking from the keyboard-alternative select) a card
  // onto a person's column ADDS that person as a co-assignee — it never
  // replaces the existing one, so a task's current assignees are never
  // silently dropped. The drag interaction and its non-drag alternative
  // both call this same function, so they can't drift apart in meaning
  // (a real WCAG 2.2 requirement, not just consistency for its own sake).
  const handleBoardAdd = async (task, targetUserId) => {
    setDragOverColumn(null);
    if (targetUserId === task.assigned_to) return;
    try {
      await client.post(
        `/api/tasks/${task._id}/assignees`,
        { user_id: targetUserId },
        { headers: { "x-ministry-id": task.ministry_id } },
      );
      await fetchTeamOverview();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add that person to this task");
    }
  };

  const handleBoardComplete = async (task) => {
    setDragOverColumn(null);
    try {
      await client.put(`/api/tasks/${task._id}/complete`, null, {
        headers: { "x-ministry-id": task.ministry_id },
      });
      await fetchTeamOverview();
    } catch (err) {
      setError("Failed to complete this task");
    }
  };

  const handleBoardReopen = async (task) => {
    try {
      await client.put(`/api/tasks/${task._id}/reopen`, null, {
        headers: { "x-ministry-id": task.ministry_id },
      });
      await fetchTeamOverview();
    } catch (err) {
      setError("Failed to reopen this task");
    }
  };

  const handleBoardHold = async (task) => {
    try {
      await client.put(
        `/api/tasks/${task._id}/hold`,
        {},
        { headers: { "x-ministry-id": task.ministry_id } },
      );
      await fetchTeamOverview();
    } catch (err) {
      setError("Failed to put this task on hold");
    }
  };

  // Removing someone from a shared task is just deleting their own row —
  // the other sibling documents (and the task itself, for them) are
  // untouched.
  const handleRemoveFromBoard = async (task) => {
    try {
      await client.delete(`/api/tasks/${task._id}`, {
        headers: { "x-ministry-id": task.ministry_id },
      });
      await fetchTeamOverview();
    } catch (err) {
      setError("Failed to remove this person from the task");
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
          aria-label="Assign to"
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
          aria-label="Due date"
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
      {(task.siblings?.length > 0 || team.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {task.siblings?.map((s) => (
            <span
              key={s.task_id}
              style={{
                fontSize: "10px",
                padding: "3px 8px",
                borderRadius: "10px",
                background: "var(--gray-200)",
                color: "var(--gray-600)",
              }}
            >
              {s.status === "done" ? "✓ " : s.status === "on_hold" ? "⏸ " : ""}
              {s.name}
              <span
                {...clickableDivProps(() => handleRemoveSibling(s.task_id, task.ministry_id))}
                aria-label={`Remove ${s.name} from "${task.title}"`}
                style={{ marginLeft: "4px", cursor: "pointer" }}
              >
                ×
              </span>
            </span>
          ))}
          <select
            aria-label={`Add someone else to "${task.title}"`}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) handleAddAssignee(task, e.target.value);
              e.target.value = "";
            }}
            style={{
              fontSize: "11px",
              padding: "4px 8px",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "6px",
              color: "var(--gray-600)",
              background: "var(--white)",
            }}
          >
            <option value="">+ Add someone</option>
            {team
              .filter(
                (m) =>
                  m._id !== task.assigned_to &&
                  !(task.siblings || []).some((s) => s.user_id === m._id),
              )
              .map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
          </select>
        </div>
      )}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <select
          aria-label="Repeat frequency"
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
              aria-label="Repeat interval"
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

  const renderDoneDetail = (task) => (
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
      <div>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--charcoal)" }}>{task.title}</div>
        {task.description && (
          <div style={{ fontSize: "11px", color: "var(--gray-600)", marginTop: "4px" }}>{task.description}</div>
        )}
        <div style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "6px" }}>
          Completed{" "}
          {task.completed_at
            ? new Date(task.completed_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : ""}
        </div>
      </div>

      <div>
        <label
          style={{
            display: "block",
            fontSize: "10px",
            color: "var(--gray-500)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: "6px",
          }}
        >
          Notes
        </label>
        {editingNotesTaskId === task._id ? (
          <>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button
                onClick={() => handleSaveNotes(task)}
                disabled={savingNotes}
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
                {savingNotes ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditingNotesTaskId(null)}
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
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: "12px", color: task.completion_notes ? "var(--charcoal)" : "var(--gray-500)" }}>
              {task.completion_notes || "No notes added."}
            </div>
            <button
              onClick={() => {
                setEditingNotesTaskId(task._id);
                setNotesDraft(task.completion_notes || "");
              }}
              style={{
                marginTop: "6px",
                padding: 0,
                background: "transparent",
                color: "var(--navy)",
                border: "none",
                fontSize: "11px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {task.completion_notes ? "Edit notes" : "Add notes"}
            </button>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => handleReopen(task)}
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
          Reopen
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
          Close
        </button>
      </div>
    </div>
  );

  const renderTask = (task, { showAssignee } = {}) => {
    if (editingTaskId === task._id) {
      return task.status === "done" ? renderDoneDetail(task) : renderEditForm(task);
    }

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
          opacity: task.status === "done" ? 0.6 : 1,
        }}
      >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
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
            {task.status === "on_hold" && (
              <span
                title={task.hold_reason || "On hold"}
                style={{
                  marginLeft: "6px",
                  fontSize: "9px",
                  fontWeight: "600",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  color: "#8a6200",
                  background: "#fff6df",
                }}
              >
                ⏸ On hold
              </span>
            )}
          </div>
          {task.siblings?.length > 0 && (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
              {task.siblings.map((s) => (
                <span
                  key={s.task_id}
                  style={{
                    fontSize: "9px",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    background: "var(--gray-200)",
                    color: "var(--gray-600)",
                  }}
                >
                  {s.status === "done" ? "✓ " : s.status === "on_hold" ? "⏸ " : ""}
                  {s.name}
                  <span
                    {...clickableDivProps((e) => {
                      e?.stopPropagation?.();
                      handleRemoveSibling(s.task_id, task.ministry_id);
                    })}
                    aria-label={`Remove ${s.name} from "${task.title}"`}
                    style={{ marginLeft: "4px", cursor: "pointer" }}
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0, alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: "6px" }}>
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
              {task.status === "done" ? "View" : "Edit"}
            </button>
            {task.status !== "done" && completingTaskId !== task._id && (
              <button
                onClick={() => {
                  setCompletingTaskId(task._id);
                  setCompleteNotesDraft("");
                }}
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
            )}
            {task.status === "open" && (
              <button
                onClick={() => handleHold(task)}
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
                ⏸ Hold
              </button>
            )}
            {task.status !== "open" && (
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
                {task.status === "on_hold" ? "▶ Resume" : "Reopen"}
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
          <select
            aria-label={`Add someone else to "${task.title}"`}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) handleAddAssignee(task, e.target.value);
              e.target.value = "";
            }}
            style={{
              fontSize: "10px",
              padding: "3px 6px",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "6px",
              color: "var(--gray-600)",
              background: "var(--white)",
            }}
          >
            <option value="">+ Add someone</option>
            {team
              .filter(
                (m) =>
                  m._id !== task.assigned_to &&
                  !(task.siblings || []).some((s) => s.user_id === m._id),
              )
              .map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {completingTaskId === task._id && (
        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "0.5px solid var(--gray-300)" }}>
          <textarea
            value={completeNotesDraft}
            onChange={(e) => setCompleteNotesDraft(e.target.value)}
            placeholder="Add a note about how this was completed (optional)"
            rows={2}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius)",
              fontSize: "12px",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              onClick={() => handleComplete(task, completeNotesDraft)}
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
              Confirm complete
            </button>
            <button
              onClick={() => {
                setCompletingTaskId(null);
                setCompleteNotesDraft("");
              }}
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
              Cancel
            </button>
          </div>
        </div>
      )}
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
          {similarTasks.length > 0 && (
            <div
              style={{
                background: "#fff8ec",
                border: "0.5px solid #f0d080",
                borderRadius: "var(--border-radius)",
                padding: "8px 12px",
                fontSize: "11px",
                color: "#8a6200",
              }}
            >
              Looks similar to an existing task:{" "}
              {similarTasks.map((t, i) => (
                <span key={t._id}>
                  {i > 0 && ", "}
                  <strong>{t.title}</strong> ({t.assignee_name})
                </span>
              ))}
              . Creating a new one below won't touch those — just checking it's not an accidental duplicate.
            </div>
          )}
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
            <div style={{ flex: 1, minWidth: "180px" }}>
              <select
                multiple
                aria-label="Assign to"
                value={form.assignedTo}
                onChange={(e) =>
                  setForm({ ...form, assignedTo: Array.from(e.target.selectedOptions, (o) => o.value) })
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "0.5px solid var(--gray-300)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "13px",
                  minHeight: "76px",
                }}
              >
                {team.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "2px" }}>
                Hold Cmd/Ctrl to assign more than one person
              </div>
            </div>
            <input
              type="date"
              aria-label="Due date"
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
              aria-label="Repeat frequency"
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
                  aria-label="Repeat interval"
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
              { key: "active", label: "Open" },
              { key: "on_hold", label: "On hold" },
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
            // Movements) — every card also needs a way to add/complete
            // it without dragging. These real <select>/<button> elements
            // are that alternative, not just a decoration.
            const personOptions = Object.entries(teamOverview).map(([id, { name }]) => ({ id, name }));
            const nameById = Object.fromEntries(personOptions.map((p) => [p.id, p.name]));
            const allBoardTasks = Object.values(teamOverview).flatMap(({ tasks }) => tasks);
            // Other rows sharing this task's group_id — i.e. the rest of
            // a shared task's assignees, each with their own status.
            const siblingsOf = (task) =>
              task.group_id ? allBoardTasks.filter((t) => t.group_id === task.group_id && t._id !== task._id) : [];
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
                      if (draggedTask) handleBoardAdd(draggedTask, userId);
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
                        const onHold = t.status === "on_hold";
                        const siblings = siblingsOf(t);
                        const addOptions = personOptions.filter(
                          (p) => p.id !== userId && !siblings.some((s) => s.assigned_to === p.id),
                        );
                        return (
                          <div
                            key={t._id}
                            draggable
                            onDragStart={() => setDraggedTask(t)}
                            onDragEnd={() => setDraggedTask(null)}
                            title={onHold ? t.hold_reason || "On hold" : undefined}
                            style={{
                              background: "var(--white)",
                              border: onHold ? "1px solid var(--gold)" : "0.5px solid var(--gray-300)",
                              borderRadius: "var(--border-radius)",
                              padding: "10px",
                              boxShadow: "var(--shadow)",
                              cursor: "grab",
                            }}
                          >
                            <div style={{ fontSize: "12px", color: "var(--charcoal)" }}>{t.title}</div>
                            <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                              {due && (
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: "600",
                                    padding: "2px 6px",
                                    borderRadius: "10px",
                                    color: due.overdue ? "#c0504d" : "var(--gray-600)",
                                    background: due.overdue ? "#fdf0f0" : "var(--gray-200)",
                                  }}
                                >
                                  {due.label}
                                </span>
                              )}
                              {onHold && (
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: "600",
                                    padding: "2px 6px",
                                    borderRadius: "10px",
                                    color: "#8a6200",
                                    background: "#fff6df",
                                  }}
                                >
                                  ⏸ On hold
                                </span>
                              )}
                            </div>
                            {siblings.length > 0 && (
                              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                                {siblings.map((s) => (
                                  <span
                                    key={s._id}
                                    style={{
                                      fontSize: "9px",
                                      padding: "2px 6px",
                                      borderRadius: "10px",
                                      background: "var(--gray-200)",
                                      color: "var(--gray-600)",
                                    }}
                                  >
                                    {s.status === "done" ? "✓ " : s.status === "on_hold" ? "⏸ " : ""}
                                    {nameById[s.assigned_to] || "Someone"}
                                    <span
                                      {...clickableDivProps(() => handleRemoveFromBoard(s))}
                                      aria-label={`Remove ${nameById[s.assigned_to] || "them"} from "${t.title}"`}
                                      style={{ marginLeft: "4px", cursor: "pointer" }}
                                    >
                                      ×
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                            <select
                              aria-label={`Add someone else to "${t.title}"`}
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) handleBoardAdd(t, e.target.value);
                                e.target.value = "";
                              }}
                              style={{
                                width: "100%",
                                marginTop: "8px",
                                fontSize: "10px",
                                padding: "3px 4px",
                                border: "0.5px solid var(--gray-300)",
                                borderRadius: "6px",
                                color: "var(--gray-600)",
                                background: "var(--white)",
                              }}
                            >
                              <option value="">+ Add someone</option>
                              {addOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <div style={{ display: "flex", gap: "6px", marginTop: "6px", alignItems: "center" }}>
                              <button
                                type="button"
                                aria-label={`Mark "${t.title}" done`}
                                onClick={() => handleBoardComplete(t)}
                                style={{
                                  flex: 1,
                                  fontSize: "10px",
                                  padding: "3px 6px",
                                  border: "0.5px solid #b4d8b4",
                                  borderRadius: "6px",
                                  background: "transparent",
                                  color: "#3a7a4a",
                                  cursor: "pointer",
                                }}
                              >
                                ✓ Done
                              </button>
                              {onHold ? (
                                <button
                                  type="button"
                                  aria-label={`Resume "${t.title}"`}
                                  onClick={() => handleBoardReopen(t)}
                                  style={{
                                    flex: 1,
                                    fontSize: "10px",
                                    padding: "3px 6px",
                                    border: "0.5px solid var(--gray-300)",
                                    borderRadius: "6px",
                                    background: "transparent",
                                    color: "var(--gray-600)",
                                    cursor: "pointer",
                                  }}
                                >
                                  ▶ Resume
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  aria-label={`Put "${t.title}" on hold`}
                                  onClick={() => handleBoardHold(t)}
                                  style={{
                                    flex: 1,
                                    fontSize: "10px",
                                    padding: "3px 6px",
                                    border: "0.5px solid var(--gray-300)",
                                    borderRadius: "6px",
                                    background: "transparent",
                                    color: "var(--gray-600)",
                                    cursor: "pointer",
                                  }}
                                >
                                  ⏸ Hold
                                </button>
                              )}
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
                      if (draggedTask) handleBoardComplete(draggedTask);
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
                          {siblingsOf(t).length > 0 && (
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                              {siblingsOf(t).map((s) => (
                                <span
                                  key={s._id}
                                  style={{
                                    fontSize: "9px",
                                    padding: "2px 6px",
                                    borderRadius: "10px",
                                    background: "var(--gray-200)",
                                    color: "var(--gray-600)",
                                  }}
                                >
                                  {s.status === "done" ? "✓ " : s.status === "on_hold" ? "⏸ " : ""}
                                  {nameById[s.assigned_to] || "Someone"}
                                </span>
                              ))}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: "6px", marginTop: "8px", alignItems: "center" }}>
                            <button
                              type="button"
                              aria-label={`Reopen "${t.title}"`}
                              onClick={() => handleBoardReopen(t)}
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
