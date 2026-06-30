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

const Calendar = () => {
  const { ministryId } = useAuth();
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

  const fetchOccurrences = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(gridDays[0]);
      const to = new Date(gridDays[41]);
      to.setHours(23, 59, 59, 999);
      const res = await client.get("/api/events/expanded", {
        params: { from: from.toISOString(), to: to.toISOString() },
      });
      setOccurrences(res.data);
    } catch (err) {
      setError("Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  }, [gridDays]);

  const fetchPending = useCallback(async () => {
    try {
      const res = await client.get("/api/events", { params: { status: "pending" } });
      setPending(res.data);
    } catch (err) {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchOccurrences();
  }, [fetchOccurrences]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

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

  const resetForm = () => {
    setForm(emptyForm);
    setRecurrence(emptyRecurrence);
    setError("");
    setShowForm(false);
  };

  const handleCreate = async () => {
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

      await client.post("/api/events", {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
        start: startIso,
        end: endIso,
        all_day: form.all_day,
        visibility: form.visibility,
        recurrence_rule: buildRecurrenceRule(recurrence) || undefined,
      });
      resetForm();
      await fetchOccurrences();
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || "Failed to create event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await client.delete(`/api/events/${id}`);
      await fetchOccurrences();
      setSelectedDay(null);
    } catch (err) {
      setError("Failed to delete event");
    }
  };

  const handleApprove = async (id) => {
    try {
      await client.put(`/api/events/${id}/approve`);
      await Promise.all([fetchPending(), fetchOccurrences()]);
    } catch (err) {
      setError("Failed to approve event");
    }
  };

  const handleReject = async (id) => {
    try {
      await client.put(`/api/events/${id}/reject`);
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
            Prayer calls, meetings, and ministry events in one place
          </p>
        </div>
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
              {saving ? "Saving..." : "Add to calendar"}
            </button>
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
                    {dayEvents.slice(0, 2).map((occ, j) => (
                      <div
                        key={j}
                        style={{
                          fontSize: "9px",
                          padding: "1px 4px",
                          marginBottom: "1px",
                          borderRadius: "3px",
                          background: occ.visibility === "public" ? "#e8f4ea" : "#eef2f8",
                          color: occ.visibility === "public" ? "#3a7a4a" : "var(--navy)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {occ.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div style={{ fontSize: "9px", color: "var(--gray-400)" }}>+{dayEvents.length - 2} more</div>
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
              {selectedDayEvents.length === 0 && (
                <div style={{ fontSize: "12px", color: "var(--gray-400)" }}>No events</div>
              )}
              {selectedDayEvents.map((occ) => (
                <div key={`${occ._id}-${occ.occurrence_start}`} style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "0.5px solid var(--gray-200)" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--charcoal)" }}>{occ.title}</div>
                  <div style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "2px" }}>
                    {occ.all_day
                      ? "All day"
                      : new Date(occ.occurrence_start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    {describeRecurrence(occ) ? ` · ${describeRecurrence(occ)}` : ""}
                    {occ.visibility === "public" ? " · Public" : " · Internal"}
                  </div>
                  {occ.location && <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>{occ.location}</div>}
                  <button
                    onClick={() => handleDelete(occ._id)}
                    style={{
                      marginTop: "6px",
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
                borderRadius: "var(--border-radius-lg)",
                padding: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
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
                  onClick={() => handleApprove(event._id)}
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
                  onClick={() => handleReject(event._id)}
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
