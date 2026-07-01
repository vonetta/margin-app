import React, { useState, useEffect, useCallback, useMemo } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const WEEKDAYS = [
  { value: "SU", label: "Su" },
  { value: "MO", label: "Mo" },
  { value: "TU", label: "Tu" },
  { value: "WE", label: "We" },
  { value: "TH", label: "Th" },
  { value: "FR", label: "Fr" },
  { value: "SA", label: "Sa" },
];

const FREQUENCIES = [
  { value: "", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const buildRecurrenceRule = (recurrence) => {
  if (!recurrence.freq) return null;
  const parts = [`FREQ=${recurrence.freq}`];
  if (recurrence.interval && recurrence.interval > 1) {
    parts.push(`INTERVAL=${recurrence.interval}`);
  }
  if (recurrence.freq === "WEEKLY" && recurrence.byday.length > 0) {
    parts.push(`BYDAY=${recurrence.byday.join(",")}`);
  }
  if (recurrence.endMode === "until" && recurrence.until) {
    parts.push(`UNTIL=${recurrence.until.replace(/-/g, "")}T235959Z`);
  } else if (recurrence.endMode === "count" && recurrence.count) {
    parts.push(`COUNT=${recurrence.count}`);
  }
  return parts.join(";");
};

// Inverse of buildRecurrenceRule — pulls the recurrence UI's fields back
// out of a stored rule string so editing an existing event opens the
// form pre-filled with its actual pattern instead of blank.
const parseRecurrenceRule = (rule) => {
  if (!rule) return { ...emptyRecurrence };
  const freqMatch = rule.match(/FREQ=(\w+)/);
  const intervalMatch = rule.match(/INTERVAL=(\d+)/);
  const bydayMatch = rule.match(/BYDAY=([\w,]+)/);
  const untilMatch = rule.match(/UNTIL=(\d{8})/);
  const countMatch = rule.match(/COUNT=(\d+)/);

  let endMode = "never";
  let until = "";
  let count = 4;
  if (untilMatch) {
    endMode = "until";
    const raw = untilMatch[1];
    until = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  } else if (countMatch) {
    endMode = "count";
    count = Number(countMatch[1]);
  }

  return {
    freq: freqMatch ? freqMatch[1] : "",
    interval: intervalMatch ? Number(intervalMatch[1]) : 1,
    byday: bydayMatch ? bydayMatch[1].split(",") : [],
    endMode,
    until,
    count,
  };
};

// Local (not UTC) date/time components — the create form builds Date
// objects by interpreting `${date}T${time}` as local time, so reversing
// that with toISOString() would shift the date for anyone not in UTC.
const toLocalDateInputValue = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const toLocalTimeInputValue = (date) => {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const describeRecurrence = (event) => {
  if (!event.recurrence_rule) return null;
  const rule = event.recurrence_rule;
  if (rule.includes("FREQ=WEEKLY") && rule.includes("BYDAY=TU,TH")) return "Twice weekly";
  if (rule.includes("FREQ=WEEKLY")) return "Weekly";
  if (rule.includes("FREQ=DAILY")) return "Daily";
  if (rule.includes("FREQ=MONTHLY")) return "Monthly";
  return "Recurring";
};

const emptyForm = {
  title: "",
  description: "",
  location: "",
  startDate: "",
  startTime: "",
  endTime: "",
  all_day: false,
  visibility: "internal",
};

const emptyRecurrence = {
  freq: "",
  interval: 1,
  byday: [],
  endMode: "never",
  until: "",
  count: 4,
};

const monthLabel = (date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

const startOfCalendarGrid = (monthDate) => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const dow = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - dow);
  return gridStart;
};

const FALLBACK_COLOR = "#4a5a6a";

const Calendar = () => {
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

  const [tab, setTab] = useState("calendar");
  const [monthDate, setMonthDate] = useState(new Date());
  const [occurrences, setOccurrences] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [recurrence, setRecurrence] = useState(emptyRecurrence);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const [team, setTeam] = useState([]);
  const [visibleTo, setVisibleTo] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const gridStart = useMemo(() => startOfCalendarGrid(monthDate), [monthDate]);
  const gridDays = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
      }),
    [gridStart],
  );

  // The calendar is global across every ministry the user belongs to
  // (parent + any sub-ministries), not just the currently active one —
  // each request is fired with that ministry's own x-ministry-id so it
  // still goes through normal tenant/membership checks, just once per
  // membership instead of once overall.
  const fetchOccurrences = useCallback(async () => {
    if (memberships.length === 0) return;
    setLoading(true);
    try {
      const from = new Date(gridDays[0]);
      const to = new Date(gridDays[41]);
      to.setHours(23, 59, 59, 999);
      const results = await Promise.all(
        memberships.map((m) =>
          client
            .get("/api/events/expanded", {
              params: { from: from.toISOString(), to: to.toISOString() },
              headers: { "x-ministry-id": m.ministry_id },
            })
            .then((res) => res.data.map((occ) => ({ ...occ, ministry_id: m.ministry_id })))
            .catch(() => []),
        ),
      );
      setOccurrences(results.flat());
    } catch (err) {
      setError("Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  }, [gridDays, memberships]);

  const fetchPending = useCallback(async () => {
    if (memberships.length === 0) return;
    try {
      const results = await Promise.all(
        memberships.map((m) =>
          client
            .get("/api/events", {
              params: { status: "pending" },
              headers: { "x-ministry-id": m.ministry_id },
            })
            .then((res) => res.data.map((e) => ({ ...e, ministry_id: m.ministry_id })))
            .catch(() => []),
        ),
      );
      setPending(results.flat());
    } catch (err) {
      // non-fatal
    }
  }, [memberships]);

  // Tasks assigned to you with a due date show up on the day they're due,
  // the same way events do — only open ones, so the calendar doesn't fill
  // up with things you've already finished.
  const fetchTasks = useCallback(async () => {
    if (memberships.length === 0) return;
    try {
      const results = await Promise.all(
        memberships.map((m) =>
          client
            .get("/api/tasks", {
              params: { status: "open" },
              headers: { "x-ministry-id": m.ministry_id },
            })
            .then((res) => res.data.map((t) => ({ ...t, ministry_id: m.ministry_id })))
            .catch(() => []),
        ),
      );
      setTasks(results.flat().filter((t) => t.due_date));
    } catch (err) {
      // non-fatal
    }
  }, [memberships]);

  useEffect(() => {
    fetchOccurrences();
  }, [fetchOccurrences]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    client
      .get("/api/ministry/team")
      .then((res) => setTeam(res.data || []))
      .catch(() => setTeam([]));
  }, []);

  const occurrencesByDay = useMemo(() => {
    const map = {};
    for (const occ of occurrences) {
      if (occ.status === "pending") continue;
      const key = new Date(occ.occurrence_start).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(occ);
    }
    return map;
  }, [occurrences]);

  const tasksByDay = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      const key = new Date(t.due_date).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [tasks]);

  const handleCompleteTask = async (task) => {
    try {
      await client.put(`/api/tasks/${task._id}/complete`, null, {
        headers: { "x-ministry-id": task.ministry_id },
      });
      await fetchTasks();
    } catch (err) {
      setError("Failed to complete task");
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setRecurrence(emptyRecurrence);
    setVisibleTo([]);
    setEditingEvent(null);
    setError("");
    setShowForm(false);
  };

  const toggleVisibleTo = (userId) => {
    setVisibleTo((v) => (v.includes(userId) ? v.filter((id) => id !== userId) : [...v, userId]));
  };

  // occ is one occurrence-expanded event from selectedDayEvents — its
  // start/end/recurrence_rule fields are still the base event's real
  // (non-occurrence) values, so pre-filling from them edits the whole
  // series, not just the one day clicked into.
  const startEditEvent = (occ) => {
    setEditingEvent({ _id: occ._id, ministry_id: occ.ministry_id });
    setForm({
      title: occ.title,
      description: occ.description || "",
      location: occ.location || "",
      startDate: toLocalDateInputValue(occ.start),
      startTime: occ.all_day ? "" : toLocalTimeInputValue(occ.start),
      endTime: !occ.all_day && occ.end ? toLocalTimeInputValue(occ.end) : "",
      all_day: !!occ.all_day,
      visibility: occ.visibility,
    });
    setRecurrence(parseRecurrenceRule(occ.recurrence_rule));
    setVisibleTo(occ.visible_to || []);
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.startDate) {
      setError("Title and start date are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const startIso = new Date(
        `${form.startDate}T${form.all_day ? "00:00" : form.startTime || "00:00"}`,
      ).toISOString();
      const endIso =
        !form.all_day && form.endTime
          ? new Date(`${form.startDate}T${form.endTime}`).toISOString()
          : undefined;

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
        start: startIso,
        end: endIso,
        all_day: form.all_day,
        visibility: form.visibility,
        visible_to: form.visibility === "internal" ? visibleTo : undefined,
        recurrence_rule: buildRecurrenceRule(recurrence) || undefined,
      };

      if (editingEvent) {
        // Edits target the event's own ministry, which may not be the
        // currently active one — the calendar aggregates across every
        // ministry the user belongs to.
        await client.put(`/api/events/${editingEvent._id}`, payload, {
          headers: { "x-ministry-id": editingEvent.ministry_id },
        });
      } else {
        await client.post("/api/events", payload);
      }
      resetForm();
      await fetchOccurrences();
    } catch (err) {
      setError(
        err.response?.data?.errors?.[0]?.msg ||
          err.response?.data?.error ||
          `Failed to ${editingEvent ? "save" : "create"} event`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, mId) => {
    try {
      await client.delete(`/api/events/${id}`, { headers: { "x-ministry-id": mId } });
      setConfirmDeleteId(null);
      await fetchOccurrences();
      setSelectedDay(null);
    } catch (err) {
      setError("Failed to delete event");
    }
  };

  const handleApprove = async (id, mId) => {
    try {
      await client.put(`/api/events/${id}/approve`, null, { headers: { "x-ministry-id": mId } });
      await Promise.all([fetchPending(), fetchOccurrences()]);
    } catch (err) {
      setError("Failed to approve event");
    }
  };

  const handleReject = async (id, mId) => {
    try {
      await client.put(`/api/events/${id}/reject`, null, { headers: { "x-ministry-id": mId } });
      await fetchPending();
    } catch (err) {
      setError("Failed to reject event");
    }
  };

  const toggleByday = (value) => {
    setRecurrence((r) => ({
      ...r,
      byday: r.byday.includes(value) ? r.byday.filter((d) => d !== value) : [...r.byday, value],
    }));
  };

  const publicFeedUrl = `${process.env.REACT_APP_API_URL || ""}/api/public/calendar/${ministryId}.ics`;
  const [feedCopied, setFeedCopied] = useState(false);
  const copyFeedUrl = () => {
    navigator.clipboard.writeText(publicFeedUrl);
    setFeedCopied(true);
    setTimeout(() => setFeedCopied(false), 2000);
  };

  const selectedDayEvents = selectedDay ? occurrencesByDay[selectedDay.toDateString()] || [] : [];
  const selectedDayTasks = selectedDay ? tasksByDay[selectedDay.toDateString()] || [] : [];

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "Cinzel, serif",
              fontSize: "20px",
              fontWeight: "500",
              letterSpacing: "0.04em",
              color: "var(--navy)",
              marginBottom: "4px",
            }}
          >
            Calendar
          </h2>
          <p style={{ fontSize: "12px", color: "var(--gray-600)" }}>
            Prayer calls, meetings, and events across every ministry you're part of
          </p>
        </div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
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
          {showForm ? "Cancel" : "+ New event"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "4px", marginBottom: "20px" }}>
        {[
          { key: "calendar", label: "Calendar" },
          { key: "queue", label: `Approval queue${pending.length ? ` (${pending.length})` : ""}` },
          { key: "website", label: "Website" },
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
          <div style={{ fontFamily: "Cinzel, serif", fontSize: "11px", color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {editingEvent ? "Edit event" : "New event"}
          </div>
          {memberships.length > 1 && (
            <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
              {editingEvent ? (
                <>
                  Editing in: <span style={{ fontWeight: "600", color: colorFor(editingEvent.ministry_id) }}>{nameFor(editingEvent.ministry_id)}</span>
                </>
              ) : (
                <>
                  Creating in: <span style={{ fontWeight: "600", color: colorFor(ministryId) }}>{nameFor(ministryId)}</span>
                  {" — switch ministries from the sidebar to add an event to a different one"}
                </>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder="Event title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "13px",
              }}
            />
            <input
              type="text"
              placeholder="Location (optional)"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "13px",
              }}
            />
          </div>

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

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              style={{
                padding: "8px 12px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "13px",
              }}
            />
            {!form.all_day && (
              <>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  style={{
                    padding: "8px 12px",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "13px",
                  }}
                />
                <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>to</span>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  style={{
                    padding: "8px 12px",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "13px",
                  }}
                />
              </>
            )}
            <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="checkbox"
                checked={form.all_day}
                onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
              />
              All day
            </label>
          </div>

          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: "10px", color: "var(--gray-600)", display: "block", marginBottom: "4px" }}>
                Repeats
              </label>
              <select
                value={recurrence.freq}
                onChange={(e) => setRecurrence({ ...emptyRecurrence, freq: e.target.value })}
                style={{
                  padding: "6px 10px",
                  border: "0.5px solid var(--gray-300)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "12px",
                }}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {recurrence.freq && (
              <div>
                <label style={{ fontSize: "10px", color: "var(--gray-600)", display: "block", marginBottom: "4px" }}>
                  Every
                </label>
                <input
                  type="number"
                  min={1}
                  value={recurrence.interval}
                  onChange={(e) => setRecurrence({ ...recurrence, interval: Number(e.target.value) || 1 })}
                  style={{
                    width: "50px",
                    padding: "6px 8px",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                  }}
                />
                <span style={{ fontSize: "11px", marginLeft: "4px", color: "var(--gray-500)" }}>
                  {recurrence.freq === "DAILY" ? "day(s)" : recurrence.freq === "WEEKLY" ? "week(s)" : "month(s)"}
                </span>
              </div>
            )}

            {recurrence.freq === "WEEKLY" && (
              <div>
                <label style={{ fontSize: "10px", color: "var(--gray-600)", display: "block", marginBottom: "4px" }}>
                  On
                </label>
                <div style={{ display: "flex", gap: "4px" }}>
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleByday(d.value)}
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "50%",
                        border: `1px solid ${recurrence.byday.includes(d.value) ? "var(--navy)" : "var(--gray-300)"}`,
                        background: recurrence.byday.includes(d.value) ? "var(--navy)" : "transparent",
                        color: recurrence.byday.includes(d.value) ? "var(--white)" : "var(--charcoal)",
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {recurrence.freq && (
              <div>
                <label style={{ fontSize: "10px", color: "var(--gray-600)", display: "block", marginBottom: "4px" }}>
                  Ends
                </label>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <select
                    value={recurrence.endMode}
                    onChange={(e) => setRecurrence({ ...recurrence, endMode: e.target.value })}
                    style={{
                      padding: "6px 8px",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                    }}
                  >
                    <option value="never">Never</option>
                    <option value="until">On date</option>
                    <option value="count">After N times</option>
                  </select>
                  {recurrence.endMode === "until" && (
                    <input
                      type="date"
                      value={recurrence.until}
                      onChange={(e) => setRecurrence({ ...recurrence, until: e.target.value })}
                      style={{
                        padding: "6px 8px",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                      }}
                    />
                  )}
                  {recurrence.endMode === "count" && (
                    <input
                      type="number"
                      min={1}
                      value={recurrence.count}
                      onChange={(e) => setRecurrence({ ...recurrence, count: Number(e.target.value) || 1 })}
                      style={{
                        width: "50px",
                        padding: "6px 8px",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: "10px", color: "var(--gray-600)", display: "block", marginBottom: "4px" }}>
              Visibility
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              {[
                { value: "internal", label: "Internal — team only" },
                { value: "public", label: "Public — also on the website" },
              ].map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setForm({ ...form, visibility: v.value })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--border-radius)",
                    border: `1.5px solid ${form.visibility === v.value ? "var(--navy)" : "var(--gray-300)"}`,
                    background: form.visibility === v.value ? "#f4f8fb" : "transparent",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {form.visibility === "internal" && team.length > 0 && (
            <div>
              <label style={{ fontSize: "10px", color: "var(--gray-600)", display: "block", marginBottom: "4px" }}>
                Visible to (leave empty for the whole team)
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {team.map((member) => (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => toggleVisibleTo(member._id)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "var(--border-radius)",
                      border: `1.5px solid ${visibleTo.includes(member._id) ? "var(--navy)" : "var(--gray-300)"}`,
                      background: visibleTo.includes(member._id) ? "#f4f8fb" : "transparent",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSave}
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
              {saving ? "Saving..." : editingEvent ? "Save changes" : "Add to calendar"}
            </button>
            {editingEvent && (
              <button
                onClick={resetForm}
                style={{
                  padding: "8px 16px",
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
            )}
          </div>
        </div>
      )}

      {tab === "calendar" && (
        <div style={{ display: "grid", gridTemplateColumns: selectedDay ? "1fr 280px" : "1fr", gap: "16px" }}>
          <div
            style={{
              background: "var(--white)",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <button
                onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--navy)" }}
              >
                ‹
              </button>
              <div style={{ fontFamily: "Cinzel, serif", fontSize: "14px", color: "var(--navy)" }}>
                {monthLabel(monthDate)}
              </div>
              <button
                onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--navy)" }}
              >
                ›
              </button>
            </div>

            {memberships.length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                {memberships.map((m) => (
                  <div key={m.ministry_id} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "2px",
                        background: m.color || FALLBACK_COLOR,
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontSize: "10px", color: "var(--gray-600)" }}>{m.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", fontSize: "10px", color: "var(--gray-500)", marginBottom: "4px" }}>
              {WEEKDAYS.map((d) => (
                <div key={d.value} style={{ textAlign: "center", padding: "4px" }}>
                  {d.label}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px" }}>
              {gridDays.map((day, i) => {
                const inMonth = day.getMonth() === monthDate.getMonth();
                const dayEvents = occurrencesByDay[day.toDateString()] || [];
                const dayTasks = tasksByDay[day.toDateString()] || [];
                const dayItems = [
                  ...dayEvents.map((occ) => ({ ...occ, _kind: "event" })),
                  ...dayTasks.map((t) => ({ ...t, _kind: "task" })),
                ];
                const isSelected = selectedDay && selectedDay.toDateString() === day.toDateString();
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDay(day)}
                    style={{
                      minHeight: "70px",
                      padding: "4px",
                      border: `0.5px solid ${isSelected ? "var(--navy)" : "var(--gray-200)"}`,
                      background: inMonth ? "var(--white)" : "var(--gray-100)",
                      cursor: "pointer",
                      opacity: inMonth ? 1 : 0.5,
                    }}
                  >
                    <div style={{ fontSize: "10px", color: "var(--gray-500)", marginBottom: "2px" }}>
                      {day.getDate()}
                    </div>
                    {dayItems.slice(0, 2).map((item, j) => (
                      <div
                        key={j}
                        title={nameFor(item.ministry_id)}
                        style={{
                          fontSize: "9px",
                          padding: "1px 4px",
                          marginBottom: "1px",
                          borderRadius: "3px",
                          border: item._kind === "task" ? `1px dashed ${colorFor(item.ministry_id)}` : "none",
                          borderLeft: item._kind === "task" ? undefined : `2px solid ${colorFor(item.ministry_id)}`,
                          background: `${colorFor(item.ministry_id)}1a`,
                          color: colorFor(item.ministry_id),
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item._kind === "task" ? "☐ " : ""}
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div style={{ fontSize: "9px", color: "var(--gray-400)" }}>+{dayItems.length - 2} more</div>
                    )}
                  </div>
                );
              })}
            </div>
            {loading && <div style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "8px" }}>Loading...</div>}
          </div>

          {selectedDay && (
            <div
              style={{
                background: "var(--white)",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius-lg)",
                padding: "16px",
                alignSelf: "start",
              }}
            >
              <div style={{ fontFamily: "Cinzel, serif", fontSize: "12px", color: "var(--navy)", marginBottom: "12px" }}>
                {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </div>
              {selectedDayEvents.length === 0 && selectedDayTasks.length === 0 && (
                <div style={{ fontSize: "12px", color: "var(--gray-400)" }}>Nothing on this day</div>
              )}
              {selectedDayEvents.map((occ) => (
                <div
                  key={`${occ._id}-${occ.occurrence_start}`}
                  style={{
                    marginBottom: "12px",
                    paddingBottom: "12px",
                    paddingLeft: "8px",
                    borderLeft: `2px solid ${colorFor(occ.ministry_id)}`,
                    borderBottom: "0.5px solid var(--gray-200)",
                  }}
                >
                  {memberships.length > 1 && (
                    <div style={{ fontSize: "9px", color: colorFor(occ.ministry_id), fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
                      {nameFor(occ.ministry_id)}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--charcoal)" }}>{occ.title}</div>
                  <div style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "2px" }}>
                    {occ.all_day
                      ? "All day"
                      : new Date(occ.occurrence_start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    {describeRecurrence(occ) ? ` · ${describeRecurrence(occ)}` : ""}
                    {occ.visibility === "public" ? " · Public" : " · Internal"}
                    {occ.visibility === "internal" && occ.visible_to?.length > 0
                      ? ` (${occ.visible_to.length} ${occ.visible_to.length === 1 ? "person" : "people"})`
                      : ""}
                  </div>
                  {occ.location && <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>{occ.location}</div>}
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                    <button
                      onClick={() => startEditEvent(occ)}
                      style={{
                        padding: "3px 8px",
                        background: "transparent",
                        border: "0.5px solid var(--navy)",
                        color: "var(--navy)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    {confirmDeleteId === occ._id ? (
                      <>
                        <button
                          onClick={() => handleDelete(occ._id, occ.ministry_id)}
                          style={{
                            padding: "3px 8px",
                            background: "#c0504d",
                            border: "none",
                            color: "var(--white)",
                            borderRadius: "var(--border-radius)",
                            fontSize: "10px",
                            cursor: "pointer",
                          }}
                        >
                          Confirm delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            padding: "3px 8px",
                            background: "transparent",
                            border: "0.5px solid var(--gray-300)",
                            color: "var(--gray-600)",
                            borderRadius: "var(--border-radius)",
                            fontSize: "10px",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(occ._id)}
                        style={{
                          padding: "3px 8px",
                          background: "transparent",
                          border: "0.5px solid #e8b4b4",
                          color: "#c0504d",
                          borderRadius: "var(--border-radius)",
                          fontSize: "10px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {selectedDayTasks.map((task) => (
                <div
                  key={task._id}
                  style={{
                    marginBottom: "10px",
                    paddingBottom: "10px",
                    paddingLeft: "8px",
                    borderLeft: `2px dashed ${colorFor(task.ministry_id)}`,
                    borderBottom: "0.5px solid var(--gray-200)",
                  }}
                >
                  {memberships.length > 1 && (
                    <div style={{ fontSize: "9px", color: colorFor(task.ministry_id), fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
                      {nameFor(task.ministry_id)}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--charcoal)" }}>☐ {task.title}</div>
                  <div style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "2px" }}>Task due</div>
                  <button
                    onClick={() => handleCompleteTask(task)}
                    style={{
                      marginTop: "6px",
                      padding: "3px 8px",
                      background: "var(--navy)",
                      border: "none",
                      color: "var(--white)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "10px",
                      cursor: "pointer",
                    }}
                  >
                    ✓ Done
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "queue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {pending.length === 0 && (
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
              Nothing waiting on approval. Events auto-created from generated flyers will show up here.
            </div>
          )}
          {pending.map((event) => (
            <div
              key={event._id}
              style={{
                background: "var(--white)",
                border: "0.5px solid var(--gray-300)",
                borderLeft: `3px solid ${colorFor(event.ministry_id)}`,
                borderRadius: "var(--border-radius-lg)",
                padding: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                {memberships.length > 1 && (
                  <div style={{ fontSize: "9px", color: colorFor(event.ministry_id), fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
                    {nameFor(event.ministry_id)}
                  </div>
                )}
                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--charcoal)" }}>{event.title}</div>
                <div style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "2px" }}>
                  {new Date(event.start).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {event.location ? ` · ${event.location}` : ""}
                  {event.source === "flyer" ? " · From a generated flyer" : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => handleApprove(event._id, event.ministry_id)}
                  style={{
                    padding: "6px 12px",
                    background: "var(--navy)",
                    color: "var(--white)",
                    border: "none",
                    borderRadius: "var(--border-radius)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(event._id, event.ministry_id)}
                  style={{
                    padding: "6px 12px",
                    background: "transparent",
                    color: "#c0504d",
                    border: "0.5px solid #e8b4b4",
                    borderRadius: "var(--border-radius)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "website" && (
        <div
          style={{
            background: "var(--white)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius-lg)",
            padding: "24px",
            maxWidth: "640px",
          }}
        >
          <div style={{ fontFamily: "Cinzel, serif", fontSize: "13px", color: "var(--navy)", marginBottom: "8px" }}>
            Show this calendar on your WordPress site
          </div>
          <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: "1.7", marginBottom: "12px" }}>
            This link is a live calendar feed containing only the events marked <strong>Public</strong> above — internal
            items like prayer calls and staff meetings are never included. Most WordPress calendar plugins (The Events
            Calendar, Modern Events Calendar, etc.) have an "import from URL" or "subscribe" option — paste this link
            there and it'll stay in sync automatically. It also works with Google Calendar, Apple Calendar, and Outlook
            if that's ever useful.
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              readOnly
              value={publicFeedUrl}
              onFocus={(e) => e.target.select()}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                color: "var(--gray-600)",
                background: "var(--gray-100)",
              }}
            />
            <button
              onClick={copyFeedUrl}
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
              {feedCopied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
