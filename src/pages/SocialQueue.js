import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";
import PageHeader from "../components/PageHeader";
import { useUndoableDelete } from "../hooks/useUndoableDelete";
import UndoToastStack from "../components/UndoToastStack";

const TABS = [
  { key: "pending_approval", label: "Pending approval" },
  { key: "approved", label: "Scheduled" },
  { key: "posted", label: "Posted" },
  { key: "rejected", label: "Rejected" },
];

const emptyApproval = {
  targets: [],
  scheduledDate: "",
  scheduledTime: "",
};

const SocialQueue = () => {
  const [tab, setTab] = useState("pending_approval");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [approvalForm, setApprovalForm] = useState(emptyApproval);
  const [saving, setSaving] = useState(false);
  const [confirmRejectId, setConfirmRejectId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { pending: pendingDeletes, scheduleDelete, undo: undoDelete, isPending: isPendingDelete } = useUndoableDelete();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get("/api/social-posts", { params: { status: tab } });
      setPosts(res.data);
    } catch (err) {
      setError("Failed to load social posts");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    client
      .get("/api/social/accounts")
      .then((res) => setAccounts(res.data))
      .catch(() => setAccounts([]));
  }, []);

  const startApproval = (post) => {
    setApprovingId(post._id);
    setApprovalForm(emptyApproval);
    setError("");
  };

  const toggleTarget = (socialAccountId, platform) => {
    setApprovalForm((f) => {
      const exists = f.targets.some(
        (t) => t.social_account_id === socialAccountId && t.platform === platform,
      );
      return {
        ...f,
        targets: exists
          ? f.targets.filter((t) => !(t.social_account_id === socialAccountId && t.platform === platform))
          : [...f.targets, { social_account_id: socialAccountId, platform }],
      };
    });
  };

  const handleApprove = async (postId) => {
    if (approvalForm.targets.length === 0 || !approvalForm.scheduledDate) {
      setError("Pick at least one account and a scheduled date/time");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const scheduledTime = new Date(
        `${approvalForm.scheduledDate}T${approvalForm.scheduledTime || "00:00"}`,
      ).toISOString();
      await client.put(`/api/social-posts/${postId}/approve`, {
        targets: approvalForm.targets,
        scheduled_time: scheduledTime,
      });
      setApprovingId(null);
      await fetchPosts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to approve post");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (postId) => {
    try {
      await client.put(`/api/social-posts/${postId}/reject`);
      setConfirmRejectId(null);
      await fetchPosts();
    } catch (err) {
      setError("Failed to reject post");
    }
  };

  const handleDelete = (postId, caption) => {
    setConfirmDeleteId(null);
    const label = caption?.length > 30 ? `${caption.slice(0, 30)}…` : caption || "Post";
    scheduleDelete(postId, label, async () => {
      try {
        await client.delete(`/api/social-posts/${postId}`);
        await fetchPosts();
      } catch (err) {
        setError("Failed to delete post");
      }
    });
  };

  const accountLabel = (id) => accounts.find((a) => a._id === id)?.page_name || "Unknown account";

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <PageHeader
        icon="⌘"
        color="var(--navy)"
        title="Social Queue"
        subtitle="Review generated posts, pick where and when they go out, and Margin posts them itself"
      />

      <div style={{ display: "flex", gap: "4px", marginBottom: "20px" }}>
        {TABS.map((t) => (
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

      {loading ? (
        <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
      ) : posts.length === 0 ? (
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
          Nothing here right now.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
          {posts.filter((post) => !isPendingDelete(post._id)).map((post) => (
            <div
              key={post._id}
              style={{
                background: "var(--white)",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius-lg)",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {post.graphic_urls?.[0] && (
                <img
                  src={post.graphic_urls[0]}
                  alt=""
                  style={{ width: "100%", borderRadius: "var(--border-radius)", border: "0.5px solid var(--gray-300)" }}
                />
              )}
              <div style={{ fontSize: "12px", color: "var(--charcoal)", whiteSpace: "pre-wrap" }}>{post.caption}</div>

              {post.status === "approved" && post.scheduled_time && (
                <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                  Scheduled for {new Date(post.scheduled_time).toLocaleString()}
                </div>
              )}

              {post.status === "posted" && post.post_results?.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {post.post_results.map((r, i) => (
                    <div key={i} style={{ fontSize: "10px", color: r.status === "success" ? "#3a7a4a" : "#c0504d" }}>
                      {r.status === "success" ? "✓" : "✕"} {r.platform}
                      {r.error ? ` — ${r.error}` : ""}
                    </div>
                  ))}
                </div>
              )}

              {tab === "pending_approval" && approvingId === post._id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "10px", color: "var(--gray-600)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Post to
                  </div>
                  {accounts.length === 0 && (
                    <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                      No connected accounts yet — connect one on the AI Profile page first.
                    </div>
                  )}
                  {accounts.map((acct) => (
                    <div key={acct._id} style={{ display: "flex", gap: "8px" }}>
                      <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <input
                          type="checkbox"
                          checked={approvalForm.targets.some(
                            (t) => t.social_account_id === acct._id && t.platform === "facebook",
                          )}
                          onChange={() => toggleTarget(acct._id, "facebook")}
                        />
                        {acct.page_name} (Facebook)
                      </label>
                      {acct.instagram_username && (
                        <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <input
                            type="checkbox"
                            checked={approvalForm.targets.some(
                              (t) => t.social_account_id === acct._id && t.platform === "instagram",
                            )}
                            onChange={() => toggleTarget(acct._id, "instagram")}
                          />
                          @{acct.instagram_username} (Instagram)
                        </label>
                      )}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="date"
                      value={approvalForm.scheduledDate}
                      onChange={(e) => setApprovalForm({ ...approvalForm, scheduledDate: e.target.value })}
                      style={{
                        padding: "6px 8px",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                      }}
                    />
                    <input
                      type="time"
                      value={approvalForm.scheduledTime}
                      onChange={(e) => setApprovalForm({ ...approvalForm, scheduledTime: e.target.value })}
                      style={{
                        padding: "6px 8px",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => handleApprove(post._id)}
                      disabled={saving}
                      style={{
                        padding: "6px 14px",
                        background: "var(--navy)",
                        color: "var(--white)",
                        border: "none",
                        borderRadius: "var(--border-radius)",
                        fontSize: "11px",
                        fontWeight: "500",
                      }}
                    >
                      {saving ? "Saving..." : "Approve & schedule"}
                    </button>
                    <button
                      onClick={() => setApprovingId(null)}
                      style={{
                        padding: "6px 14px",
                        background: "transparent",
                        color: "var(--gray-600)",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "11px",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {tab === "pending_approval" && (
                    <button
                      onClick={() => startApproval(post)}
                      style={{
                        padding: "6px 14px",
                        background: "var(--navy)",
                        color: "var(--white)",
                        border: "none",
                        borderRadius: "var(--border-radius)",
                        fontSize: "11px",
                        fontWeight: "500",
                      }}
                    >
                      Review & approve
                    </button>
                  )}
                  {tab === "pending_approval" &&
                    (confirmRejectId === post._id ? (
                      <>
                        <button
                          onClick={() => handleReject(post._id)}
                          style={{
                            padding: "6px 14px",
                            background: "#c0504d",
                            color: "var(--white)",
                            border: "none",
                            borderRadius: "var(--border-radius)",
                            fontSize: "11px",
                          }}
                        >
                          Confirm reject
                        </button>
                        <button
                          onClick={() => setConfirmRejectId(null)}
                          style={{
                            padding: "6px 14px",
                            background: "transparent",
                            color: "var(--gray-600)",
                            border: "0.5px solid var(--gray-300)",
                            borderRadius: "var(--border-radius)",
                            fontSize: "11px",
                          }}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmRejectId(post._id)}
                        style={{
                          padding: "6px 14px",
                          background: "transparent",
                          color: "#c0504d",
                          border: "0.5px solid #e8b4b4",
                          borderRadius: "var(--border-radius)",
                          fontSize: "11px",
                        }}
                      >
                        Reject
                      </button>
                    ))}
                  {tab !== "posted" &&
                    (confirmDeleteId === post._id ? (
                      <>
                        <button
                          onClick={() => handleDelete(post._id, post.caption)}
                          style={{
                            padding: "6px 14px",
                            background: "#c0504d",
                            color: "var(--white)",
                            border: "none",
                            borderRadius: "var(--border-radius)",
                            fontSize: "11px",
                          }}
                        >
                          Confirm delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            padding: "6px 14px",
                            background: "transparent",
                            color: "var(--gray-600)",
                            border: "0.5px solid var(--gray-300)",
                            borderRadius: "var(--border-radius)",
                            fontSize: "11px",
                          }}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(post._id)}
                        style={{
                          padding: "6px 14px",
                          background: "transparent",
                          color: "#c0504d",
                          border: "0.5px solid #e8b4b4",
                          borderRadius: "var(--border-radius)",
                          fontSize: "11px",
                        }}
                      >
                        ✕
                      </button>
                    ))}
                </div>
              )}
              {post.status === "approved" && post.targets?.length > 0 && (
                <div style={{ fontSize: "10px", color: "var(--gray-500)" }}>
                  {post.targets.map((t, i) => (
                    <span key={i}>
                      {i > 0 ? ", " : ""}
                      {accountLabel(t.social_account_id)} ({t.platform})
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <UndoToastStack pending={pendingDeletes} onUndo={undoDelete} />
    </div>
  );
};

export default SocialQueue;
