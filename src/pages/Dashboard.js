import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { clickableDivProps } from "../utils/a11y";

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
  // Plan/billing info is admin-only in the UI — leaders get full
  // operational access (calendar, flyers, tasks, etc.) but don't need to
  // see subscription/usage details. The API itself stays open to any
  // authenticated member (it's informational, not a security boundary),
  // this is just what the Dashboard chooses to surface.
  const currentRole = memberships.find((m) => m.ministry_id === ministryId)?.role;
  const isAdmin = currentRole === "admin";

  const [myTasks, setMyTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [upcoming, setUpcoming] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    client
      .get("/api/ministry/plan-usage")
      .then((res) => setPlanUsage(res.data))
      .catch(() => setPlanUsage(null));
  }, [ministryId, isAdmin]);

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
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--border-radius-lg)",
          padding: "28px 32px",
          marginBottom: "28px",
          background:
            "radial-gradient(circle at 15% 20%, rgba(233,69,96,0.16), transparent 55%), radial-gradient(circle at 85% 100%, rgba(245,166,35,0.16), transparent 55%), var(--navy)",
        }}
      >
        <h2
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: "28px",
            fontWeight: "500",
            color: "var(--white)",
            letterSpacing: "0.02em",
            marginBottom: "6px",
          }}
        >
          Welcome back, {user?.name?.split(" ")[0]}
        </h2>
        <p
          style={{
            fontSize: "13px",
            color: "rgba(255,255,255,0.65)",
            letterSpacing: "0.04em",
          }}
        >
          {ministryId?.toUpperCase()} workspace
        </p>
        <div
          style={{
            width: "48px",
            height: "3px",
            background: "var(--gold)",
            borderRadius: "2px",
            marginTop: "16px",
          }}
        />
      </div>

      {ministry && !ministry.onboarding_complete && (
        <div
          {...clickableDivProps(() => navigate("/onboarding"))}
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
            gap: "28px",
            flexWrap: "wrap",
            marginBottom: "28px",
            padding: "16px 20px",
            background: "var(--white)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius-lg)",
            boxShadow: "var(--shadow)",
            borderLeft: "3px solid var(--gold)",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: "700",
              color: "var(--gold-dark)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              alignSelf: "center",
            }}
          >
            {planUsage.plan} plan
          </div>
          {Object.entries(planUsage.usage).map(([key, stat]) => {
            const unlimited = stat.limit === null;
            const atCap = !unlimited && stat.used >= stat.limit;
            const pct = unlimited ? 0 : Math.min(100, (stat.used / Math.max(stat.limit, 1)) * 100);
            return (
              <div key={key} style={{ fontSize: "12px", minWidth: "120px" }}>
                <div>
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: "700",
                      color: atCap ? "var(--accent-dark)" : "var(--navy)",
                    }}
                  >
                    {stat.used}
                  </span>
                  <span style={{ color: "var(--gray-500)" }}>
                    {" "}
                    / {unlimited ? "∞" : stat.limit}
                  </span>
                </div>
                <div style={{ color: "var(--gray-600)", marginBottom: "6px" }}>
                  {USAGE_LABELS[key]}
                </div>
                {!unlimited && (
                  <div
                    style={{
                      height: "4px",
                      borderRadius: "2px",
                      background: "var(--gray-200)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: atCap ? "var(--accent-dark)" : "var(--gold)",
                        borderRadius: "2px",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                )}
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
            boxShadow: "var(--shadow)",
            borderTop: "3px solid var(--accent)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "var(--accent)",
                  color: "var(--white)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  flexShrink: 0,
                }}
              >
                ☑
              </span>
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
            </div>
            <div
              {...clickableDivProps(() => navigate("/tasks"))}
              style={{ fontSize: "11px", color: "var(--accent-dark)", cursor: "pointer", fontWeight: "500" }}
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
                      padding: "9px 8px",
                      margin: "0 -8px",
                      borderRadius: "6px",
                      borderTop: i > 0 ? "0.5px solid var(--gray-100)" : "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gray-100)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span
                      {...clickableDivProps(() => handleCompleteTask(task))}
                      title="Mark complete"
                      aria-label={`Mark "${task.title}" complete`}
                      style={{
                        width: "15px",
                        height: "15px",
                        borderRadius: "4px",
                        border: "1.5px solid var(--accent)",
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
                          fontWeight: "600",
                          color: due.overdue ? "var(--accent-dark)" : "var(--gray-500)",
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
            boxShadow: "var(--shadow)",
            borderTop: "3px solid var(--gold)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "var(--gold)",
                  color: "var(--white)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  flexShrink: 0,
                }}
              >
                ◈
              </span>
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
            </div>
            <div
              {...clickableDivProps(() => navigate("/calendar"))}
              style={{ fontSize: "11px", color: "var(--gold-dark)", cursor: "pointer", fontWeight: "500" }}
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
                    padding: "9px 8px",
                    margin: "0 -8px",
                    borderRadius: "6px",
                    borderTop: i > 0 ? "0.5px solid var(--gray-100)" : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gray-100)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
            label: "Captions",
            desc: "Generate and review content",
            path: "/content",
            icon: "✦",
            color: "var(--accent)",
          },
          {
            label: "Flyers",
            desc: "Generate event flyers",
            path: "/flyers",
            icon: "▣",
            color: "var(--gold)",
          },
          {
            label: "Social Queue",
            desc: "Approve and schedule posts to Facebook & Instagram",
            path: "/social-queue",
            icon: "⌘",
            color: "var(--navy)",
          },
          {
            label: "People",
            desc: "Directory and groups",
            path: "/people",
            icon: "◎",
            color: "var(--accent)",
          },
          {
            label: "Communications",
            desc: "Draft emails to speakers and partners",
            path: "/communications",
            icon: "✉",
            color: "var(--gold)",
          },
          {
            label: "Calendar",
            desc: "Prayer calls, meetings, and upcoming events",
            path: "/calendar",
            icon: "◈",
            color: "var(--navy)",
          },
          {
            label: "Tasks",
            desc: "What you and your team need to get done",
            path: "/tasks",
            icon: "☑",
            color: "var(--accent)",
          },
        ].map((card) => (
          <div
            key={card.path}
            {...clickableDivProps(() => navigate(card.path), { disabled: card.comingSoon })}
            style={{
              background: "var(--white)",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px",
              cursor: card.comingSoon ? "default" : "pointer",
              opacity: card.comingSoon ? 0.5 : 1,
              boxShadow: "var(--shadow)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              if (card.comingSoon) return;
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
            }}
            onMouseLeave={(e) => {
              if (card.comingSoon) return;
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "var(--shadow)";
            }}
          >
            <span
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: card.color,
                color: "var(--white)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "15px",
                marginBottom: "12px",
              }}
            >
              {card.icon}
            </span>
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
