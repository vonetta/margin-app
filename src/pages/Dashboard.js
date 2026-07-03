import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const USAGE_LABELS = {
  team_members: "Team members",
  sub_ministries: "Sub-ministries",
  flyers_per_month: "Flyers this month",
};

const MAX_TASKS_SHOWN = 6;
const MAX_UPCOMING_SHOWN = 5;
const UPCOMING_WINDOW_DAYS = 14;

const formatDue = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const overdue = d < new Date(new Date().toDateString());
  return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), overdue };
};

const formatOccurrence = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

const Dashboard = () => {
  const { user, ministryId, ministry } = useAuth();
  const navigate = useNavigate();
  const [planUsage, setPlanUsage] = useState(null);
  const memberships = useMemo(() => user?.ministries || [], [user]);
  const nameFor = useCallback(
    (mId) => memberships.find((m) => m.ministry_id === mId)?.name || mId,
    [memberships],
  );

  const [myTasks, setMyTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [upcoming, setUpcoming] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  useEffect(() => {
    client
      .get("/api/ministry/plan-usage")
      .then((res) => setPlanUsage(res.data))
      .catch(() => setPlanUsage(null));
  }, [ministryId]);

  // Same cross-ministry aggregation pattern Tasks.js/Calendar.js already
  // use — one request per membership with its own x-ministry-id header,
  // tagged with ministry_id, flattened — rather than a single request
  // that could only ever see the currently-active ministry.
  const fetchMyTasks = useCallback(async () => {
    if (memberships.length === 0) return;
    setLoadingTasks(true);
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
      const sorted = results
        .flat()
        .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
      setMyTasks(sorted.slice(0, MAX_TASKS_SHOWN));
    } finally {
      setLoadingTasks(false);
    }
  }, [memberships]);

  const fetchUpcoming = useCallback(async () => {
    if (memberships.length === 0) return;
    setLoadingUpcoming(true);
    try {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + UPCOMING_WINDOW_DAYS);
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
      const sorted = results
        .flat()
        .sort((a, b) => new Date(a.occurrence_start) - new Date(b.occurrence_start));
      setUpcoming(sorted.slice(0, MAX_UPCOMING_SHOWN));
    } finally {
      setLoadingUpcoming(false);
    }
  }, [memberships]);

  useEffect(() => {
    fetchMyTasks();
    fetchUpcoming();
  }, [fetchMyTasks, fetchUpcoming]);

  const handleCompleteTask = async (task) => {
    try {
      await client.put(`/api/tasks/${task._id}/complete`, null, {
        headers: { "x-ministry-id": task.ministry_id },
      });
      setMyTasks((prev) => prev.filter((t) => t._id !== task._id));
    } catch (err) {
      // non-fatal — the task just stays in the list, user can retry
    }
  };

  return (
    <div style={{ padding: "32px" }}>
      <h2
        style={{
          fontFamily: "Cinzel, serif",
          fontSize: "20px",
          fontWeight: "500",
          color: "var(--navy)",
          letterSpacing: "0.04em",
          marginBottom: "8px",
        }}
      >
        Welcome back, {user?.name?.split(" ")[0]}
      </h2>
      <p
        style={{
          fontSize: "13px",
          color: "var(--gray-600)",
          marginBottom: "32px",
        }}
      >
        {ministryId?.toUpperCase()} workspace
      </p>

      {ministry && !ministry.onboarding_complete && (
        <div
          onClick={() => navigate("/onboarding")}
          style={{
            background: "#fff8ec",
            border: "0.5px solid #f0d080",
            borderRadius: "var(--border-radius-lg)",
            padding: "14px 18px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ fontSize: "13px", fontWeight: "500", color: "#b8902e" }}>
              Finish setting up {ministry.name}
            </div>
            <div style={{ fontSize: "11px", color: "#b8902e", opacity: 0.8, marginTop: "2px" }}>
              Branding, voice, and hashtags aren't fully set up yet
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#b8902e", fontWeight: "500" }}>
            Continue setup →
          </div>
        </div>
      )}

      {planUsage && (
        <div
          style={{
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
            marginBottom: "28px",
            padding: "14px 18px",
            background: "var(--white)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius-lg)",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: "600",
              color: "var(--gray-500)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              alignSelf: "center",
            }}
          >
            {planUsage.plan} plan
          </div>
          {Object.entries(planUsage.usage).map(([key, stat]) => {
            const unlimited = stat.limit === null;
            const atCap = !unlimited && stat.used >= stat.limit;
            return (
              <div key={key} style={{ fontSize: "12px" }}>
                <span style={{ fontWeight: "600", color: atCap ? "#c0504d" : "var(--charcoal)" }}>
                  {stat.used}
                </span>
                <span style={{ color: "var(--gray-500)" }}>
                  {" "}
                  / {unlimited ? "∞" : stat.limit} {USAGE_LABELS[key]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            background: "var(--white)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius-lg)",
            padding: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                fontFamily: "Cinzel, serif",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--navy)",
                letterSpacing: "0.06em",
              }}
            >
              MY TASKS
            </div>
            <div
              onClick={() => navigate("/tasks")}
              style={{ fontSize: "11px", color: "var(--gray-500)", cursor: "pointer" }}
            >
              View all →
            </div>
          </div>
          {loadingTasks ? (
            <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
          ) : myTasks.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
              Nothing on your task list.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {myTasks.map((task, i) => {
                const due = formatDue(task.due_date);
                return (
                  <div
                    key={task._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 0",
                      borderTop: i > 0 ? "0.5px solid var(--gray-100)" : "none",
                    }}
                  >
                    <span
                      onClick={() => handleCompleteTask(task)}
                      title="Mark complete"
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "3px",
                        border: "0.5px solid var(--gray-300)",
                        flexShrink: 0,
                        cursor: "pointer",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--charcoal)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {task.title}
                      </div>
                      {memberships.length > 1 && (
                        <div style={{ fontSize: "10px", color: "var(--gray-500)" }}>
                          {nameFor(task.ministry_id)}
                        </div>
                      )}
                    </div>
                    {due && (
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: "500",
                          color: due.overdue ? "#c0504d" : "var(--gray-500)",
                          flexShrink: 0,
                        }}
                      >
                        {due.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            background: "var(--white)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius-lg)",
            padding: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                fontFamily: "Cinzel, serif",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--navy)",
                letterSpacing: "0.06em",
              }}
            >
              UPCOMING
            </div>
            <div
              onClick={() => navigate("/calendar")}
              style={{ fontSize: "11px", color: "var(--gray-500)", cursor: "pointer" }}
            >
              View calendar →
            </div>
          </div>
          {loadingUpcoming ? (
            <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
          ) : upcoming.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
              Nothing in the next {UPCOMING_WINDOW_DAYS} days.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {upcoming.map((occ, i) => (
                <div
                  key={`${occ._id}-${occ.occurrence_start}`}
                  style={{
                    padding: "8px 0",
                    borderTop: i > 0 ? "0.5px solid var(--gray-100)" : "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--charcoal)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {occ.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                    {formatOccurrence(occ.occurrence_start)}
                    {occ.location ? ` · ${occ.location}` : ""}
                    {memberships.length > 1 ? ` · ${nameFor(occ.ministry_id)}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          {
            label: "Content Studio",
            desc: "Generate and review content",
            path: "/content",
          },
          {
            label: "Flyers",
            desc: "Generate event flyers",
            path: "/flyers",
          },
          {
            label: "Social Queue",
            desc: "Approve and schedule posts to Facebook & Instagram",
            path: "/social-queue",
          },
          { label: "People", desc: "Directory and groups", path: "/people" },
          {
            label: "Communications",
            desc: "Draft emails to speakers and partners",
            path: "/communications",
          },
          {
            label: "Calendar",
            desc: "Prayer calls, meetings, and upcoming events",
            path: "/calendar",
          },
          {
            label: "Tasks",
            desc: "What you and your team need to get done",
            path: "/tasks",
          },
        ].map((card) => (
          <div
            key={card.path}
            onClick={() => !card.comingSoon && navigate(card.path)}
            style={{
              background: "var(--white)",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px",
              cursor: card.comingSoon ? "default" : "pointer",
              opacity: card.comingSoon ? 0.5 : 1,
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              if (card.comingSoon) return;
              e.currentTarget.style.borderColor = "var(--navy)";
              e.currentTarget.style.boxShadow = "var(--shadow)";
            }}
            onMouseLeave={(e) => {
              if (card.comingSoon) return;
              e.currentTarget.style.borderColor = "var(--gray-300)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                fontFamily: "Cinzel, serif",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--navy)",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              {card.label.toUpperCase()}
              {card.comingSoon && (
                <span
                  style={{
                    marginLeft: "6px",
                    fontSize: "9px",
                    color: "var(--gold-dark)",
                  }}
                >
                  SOON
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--gray-600)",
              }}
            >
              {card.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
