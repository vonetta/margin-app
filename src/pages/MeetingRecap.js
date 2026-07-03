import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const labelStyle = {
  display: "block",
  fontSize: "10px",
  color: "var(--gray-600)",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "0.5px solid var(--gray-300)",
  borderRadius: "var(--border-radius)",
  fontSize: "13px",
  color: "var(--charcoal)",
  outline: "none",
};

const cardStyle = {
  background: "var(--white)",
  border: "0.5px solid var(--gray-300)",
  borderRadius: "var(--border-radius-lg)",
  padding: "20px",
  marginBottom: "16px",
};

const STATUS_LABEL = {
  pending_review: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const MeetingRecap = () => {
  const { user, ministryId } = useAuth();
  const membership = user?.ministries?.find((m) => m.ministry_id === ministryId);
  const canEdit = membership && ["admin", "leader"].includes(membership.role);

  const [error, setError] = useState("");
  const [team, setTeam] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const [inputMode, setInputMode] = useState("file");
  const [transcriptFile, setTranscriptFile] = useState(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [extracting, setExtracting] = useState(false);

  const [editingTask, setEditingTask] = useState(null); // { draftId, taskId }
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssignee, setEditAssignee] = useState("");

  const fetchTeam = useCallback(async () => {
    try {
      const res = await client.get("/api/ministry/team");
      setTeam(res.data);
    } catch (err) {
      setTeam([]);
    }
  }, []);

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await client.get("/api/meetings/transcripts");
      setDrafts(res.data);
    } catch (err) {
      console.error("Failed to load meeting transcripts");
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    if (canEdit) {
      fetchTeam();
      fetchDrafts();
    }
  }, [canEdit, fetchTeam, fetchDrafts]);

  const nameForUser = (userId) => team.find((m) => m._id === userId)?.name;

  const handleExtract = async () => {
    if (inputMode === "file" && !transcriptFile) {
      setError("A transcript file is required");
      return;
    }
    if (inputMode === "text" && !transcriptText.trim()) {
      setError("Paste the transcript text first");
      return;
    }
    setExtracting(true);
    setError("");
    try {
      const formData = new FormData();
      if (inputMode === "file") formData.append("transcript", transcriptFile);
      else formData.append("text", transcriptText);
      if (meetingTitle) formData.append("meeting_title", meetingTitle);
      if (meetingDate) formData.append("meeting_date", meetingDate);

      await client.post("/api/meetings/transcript", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTranscriptFile(null);
      setTranscriptText("");
      setMeetingTitle("");
      setMeetingDate("");
      await fetchDrafts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to extract tasks from this transcript");
    } finally {
      setExtracting(false);
    }
  };

  const startEditTask = (draftId, task) => {
    setEditingTask({ draftId, taskId: task._id });
    setEditDescription(task.description);
    setEditDueDate(task.due_date ? task.due_date.slice(0, 10) : "");
    setEditAssignee(task.matched_user_id || "");
  };

  const handleSaveTask = async () => {
    const { draftId, taskId } = editingTask;
    try {
      const res = await client.put(`/api/meetings/transcripts/${draftId}/tasks/${taskId}`, {
        description: editDescription,
        due_date: editDueDate || null,
        matched_user_id: editAssignee || null,
      });
      setDrafts((prev) => prev.map((d) => (d._id === draftId ? res.data : d)));
      setEditingTask(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save changes");
    }
  };

  const handleApproveTask = async (draftId, taskId) => {
    try {
      const res = await client.put(`/api/meetings/transcripts/${draftId}/tasks/${taskId}/approve`, {});
      setDrafts((prev) => prev.map((d) => (d._id === draftId ? res.data : d)));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to approve this task");
    }
  };

  const handleRejectTask = async (draftId, taskId) => {
    try {
      const res = await client.put(`/api/meetings/transcripts/${draftId}/tasks/${taskId}/reject`, {});
      setDrafts((prev) => prev.map((d) => (d._id === draftId ? res.data : d)));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reject this task");
    }
  };

  if (!canEdit) {
    return (
      <div style={{ padding: "32px" }}>
        <p style={{ fontSize: "13px", color: "var(--gray-600)" }}>
          Only admins and leaders can view and manage meeting recaps.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: "20px",
            fontWeight: "500",
            color: "var(--navy)",
            letterSpacing: "0.04em",
            marginBottom: "4px",
          }}
        >
          Meeting Recap
        </h2>
        <p style={{ fontSize: "12px", color: "var(--gray-600)" }}>
          Upload a meeting transcript and let AI pull out action items per person
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "10px 12px",
            borderRadius: "var(--border-radius)",
            fontSize: "12px",
            background: "#fdf0f0",
            border: "0.5px solid #e8b4b4",
            color: "#c0504d",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ maxWidth: "700px" }}>
        <div style={cardStyle}>
          <label style={labelStyle}>New transcript</label>
          <p style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "14px", lineHeight: 1.6 }}>
            Download the transcript from Zoom's cloud recording (or paste it
            directly), and AI drafts action items matched against your team
            roster. Nothing gets assigned until you review and approve each one.
          </p>

          <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
            {[
              { key: "file", label: "Upload file" },
              { key: "text", label: "Paste text" },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => setInputMode(m.key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "16px",
                  border: "0.5px solid",
                  borderColor: inputMode === m.key ? "var(--primary)" : "var(--gray-300)",
                  background: inputMode === m.key ? "var(--primary)" : "transparent",
                  color: inputMode === m.key ? "var(--white)" : "var(--gray-600)",
                  fontSize: "11px",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <input
              placeholder="Meeting title (optional)"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>

          {inputMode === "file" ? (
            <input
              type="file"
              accept=".vtt,.txt,text/plain,text/vtt"
              onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)}
              style={{ marginBottom: "10px", fontSize: "12px" }}
            />
          ) : (
            <textarea
              placeholder="Paste the transcript text here..."
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              rows={6}
              style={{ ...inputStyle, resize: "vertical", marginBottom: "10px" }}
            />
          )}

          <button
            onClick={handleExtract}
            disabled={extracting}
            style={{
              padding: "8px 16px",
              background: extracting ? "var(--gray-400)" : "var(--primary)",
              color: "var(--white)",
              border: "none",
              borderRadius: "var(--border-radius)",
              fontSize: "12px",
              fontWeight: "500",
            }}
          >
            {extracting ? "Extracting..." : "✦ Extract tasks"}
          </button>
        </div>

        {loadingDrafts ? (
          <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
        ) : (
          drafts.map((draft) => (
            <div key={draft._id} style={cardStyle}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--charcoal)", marginBottom: "4px" }}>
                {draft.meeting_title || "Untitled meeting"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "12px" }}>
                {draft.meeting_date
                  ? new Date(draft.meeting_date).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : new Date(draft.created_at).toLocaleDateString()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {draft.tasks.map((task) =>
                  editingTask?.draftId === draft._id && editingTask?.taskId === task._id ? (
                    <div
                      key={task._id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        padding: "10px",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                      }}
                    >
                      <input
                        style={inputStyle}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <select
                          style={{ ...inputStyle, flex: 1 }}
                          value={editAssignee}
                          onChange={(e) => setEditAssignee(e.target.value)}
                        >
                          <option value="">No assignee</option>
                          {team.map((m) => (
                            <option key={m._id} value={m._id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          style={{ ...inputStyle, flex: 1 }}
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={handleSaveTask}
                          style={{
                            padding: "6px 14px",
                            background: "var(--primary)",
                            color: "var(--white)",
                            border: "none",
                            borderRadius: "var(--border-radius)",
                            fontSize: "12px",
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingTask(null)}
                          style={{
                            padding: "6px 14px",
                            background: "transparent",
                            color: "var(--gray-600)",
                            border: "0.5px solid var(--gray-300)",
                            borderRadius: "var(--border-radius)",
                            fontSize: "12px",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={task._id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "12px", color: "var(--charcoal)" }}>{task.description}</div>
                        <div style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "2px" }}>
                          {task.matched_user_id
                            ? nameForUser(task.matched_user_id) || "Assigned"
                            : task.assignee_name_raw
                              ? `"${task.assignee_name_raw}" — no match found`
                              : "Unassigned"}
                          {task.due_date &&
                            ` · Due ${new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                          {` · ${STATUS_LABEL[task.status]}`}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        <button
                          onClick={() => startEditTask(draft._id, task)}
                          style={{
                            padding: "5px 10px",
                            background: "transparent",
                            color: "var(--gray-600)",
                            border: "0.5px solid var(--gray-300)",
                            borderRadius: "var(--border-radius)",
                            fontSize: "11px",
                          }}
                        >
                          ✎ Edit
                        </button>
                        {task.status !== "approved" && (
                          <button
                            onClick={() => handleApproveTask(draft._id, task._id)}
                            style={{
                              padding: "5px 10px",
                              background: "transparent",
                              color: "#3a7a4a",
                              border: "0.5px solid #b4d8b4",
                              borderRadius: "var(--border-radius)",
                              fontSize: "11px",
                            }}
                          >
                            ✓ Approve
                          </button>
                        )}
                        {task.status !== "rejected" && (
                          <button
                            onClick={() => handleRejectTask(draft._id, task._id)}
                            style={{
                              padding: "5px 10px",
                              background: "transparent",
                              color: "#c0504d",
                              border: "0.5px solid #e8b4b4",
                              borderRadius: "var(--border-radius)",
                              fontSize: "11px",
                            }}
                          >
                            ✕ Reject
                          </button>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MeetingRecap;
