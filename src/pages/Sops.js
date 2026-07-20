import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { useUndoableDelete } from "../hooks/useUndoableDelete";
import UndoToastStack from "../components/UndoToastStack";

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
  boxShadow: "var(--shadow)",
};

const Sops = () => {
  const { user, ministryId } = useAuth();
  const membership = user?.ministries?.find((m) => m.ministry_id === ministryId);
  const canEdit = membership && ["admin", "leader"].includes(membership.role);

  const [error, setError] = useState("");
  const [sopDrafts, setSopDrafts] = useState([]);
  const [loadingSops, setLoadingSops] = useState(false);
  const [sopStatusFilter, setSopStatusFilter] = useState("pending_review");
  const [sopInputMode, setSopInputMode] = useState("images");
  const [sopImages, setSopImages] = useState([]);
  const [sopNotes, setSopNotes] = useState("");
  const [generatingSop, setGeneratingSop] = useState(false);
  const [manualSopTitle, setManualSopTitle] = useState("");
  const [manualSopContent, setManualSopContent] = useState("");
  const [addingManualSop, setAddingManualSop] = useState(false);
  const [editingSopId, setEditingSopId] = useState(null);
  const [editSopTitle, setEditSopTitle] = useState("");
  const [editSopContent, setEditSopContent] = useState("");
  const [confirmDeleteSopId, setConfirmDeleteSopId] = useState(null);
  const { pending: pendingDeletes, scheduleDelete, undo: undoDelete, isPending: isPendingDelete } = useUndoableDelete();
  const [rejectingSopId, setRejectingSopId] = useState(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [exportingSopId, setExportingSopId] = useState(null);

  const fetchSopDrafts = useCallback(async () => {
    setLoadingSops(true);
    try {
      const res = await client.get("/api/profile/sops/drafts");
      setSopDrafts(res.data);
    } catch (err) {
      console.error("Failed to load SOP drafts");
    } finally {
      setLoadingSops(false);
    }
  }, []);

  useEffect(() => {
    if (canEdit) fetchSopDrafts();
  }, [canEdit, fetchSopDrafts]);

  const handleGenerateSop = async () => {
    if (sopImages.length === 0) {
      setError("At least one image is required to draft an SOP");
      return;
    }
    setGeneratingSop(true);
    setError("");
    try {
      const formData = new FormData();
      sopImages.forEach((f) => formData.append("images", f));
      formData.append("notes", sopNotes);
      await client.post("/api/profile/sops/draft", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSopImages([]);
      setSopNotes("");
      setSopStatusFilter("pending_review");
      await fetchSopDrafts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to draft an SOP from these images");
    } finally {
      setGeneratingSop(false);
    }
  };

  const handleAddManualSop = async () => {
    if (!manualSopTitle.trim() || !manualSopContent.trim()) {
      setError("Title and content are both required");
      return;
    }
    setAddingManualSop(true);
    setError("");
    try {
      await client.post("/api/profile/sops", {
        title: manualSopTitle.trim(),
        content: manualSopContent.trim(),
      });
      setManualSopTitle("");
      setManualSopContent("");
      setSopStatusFilter("pending_review");
      await fetchSopDrafts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add this SOP");
    } finally {
      setAddingManualSop(false);
    }
  };

  const startEditSop = (draft) => {
    setEditingSopId(draft._id);
    setEditSopTitle(draft.title);
    setEditSopContent(draft.content);
  };

  const handleSaveSopEdit = async (id) => {
    try {
      const res = await client.put(`/api/profile/sops/drafts/${id}`, {
        title: editSopTitle,
        content: editSopContent,
      });
      setSopDrafts((prev) => prev.map((d) => (d._id === id ? res.data : d)));
      setEditingSopId(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save changes");
    }
  };

  const handleApproveSop = async (id) => {
    try {
      const res = await client.put(`/api/profile/sops/drafts/${id}/approve`, {});
      setSopDrafts((prev) => prev.map((d) => (d._id === id ? res.data : d)));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to approve SOP");
    }
  };

  const handleRejectSop = async (id, notes) => {
    try {
      const res = await client.put(`/api/profile/sops/drafts/${id}/reject`, {
        notes: notes?.trim() || undefined,
      });
      setSopDrafts((prev) => prev.map((d) => (d._id === id ? res.data : d)));
      setRejectingSopId(null);
      setRejectNotes("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reject SOP");
    }
  };

  const handleDeleteSop = (id, title) => {
    setConfirmDeleteSopId(null);
    scheduleDelete(id, title || "SOP", async () => {
      try {
        await client.delete(`/api/profile/sops/drafts/${id}`);
        setSopDrafts((prev) => prev.filter((d) => d._id !== id));
      } catch (err) {
        setError("Failed to delete SOP draft");
      }
    });
  };

  // The export route requires the Bearer auth header, so a plain
  // <a href> can't be used the way flyer downloads are (those point at a
  // public storage URL) — fetch the PDF as a blob and trigger the download
  // from that instead.
  const handleExportSop = async (draft, mode) => {
    setExportingSopId(draft._id);
    setError("");
    try {
      const res = await client.get(`/api/profile/sops/drafts/${draft._id}/export?mode=${mode}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${draft.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export this SOP");
    } finally {
      setExportingSopId(null);
    }
  };

  if (!canEdit) {
    return (
      <div style={{ padding: "32px" }}>
        <p style={{ fontSize: "13px", color: "var(--gray-600)" }}>
          Only admins and leaders can view and manage SOPs.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <PageHeader
        icon="▤"
        color="var(--accent)"
        title="SOPs"
        subtitle="Draft, review, and approve Standard Operating Procedures"
      />

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
        <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
          {[
            { key: "images", label: "Draft from images" },
            { key: "manual", label: "I already have an SOP" },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setSopInputMode(m.key)}
              style={{
                padding: "5px 12px",
                borderRadius: "16px",
                border: "0.5px solid",
                borderColor: sopInputMode === m.key ? "var(--primary)" : "var(--gray-300)",
                background: sopInputMode === m.key ? "var(--primary)" : "transparent",
                color: sopInputMode === m.key ? "var(--white)" : "var(--gray-600)",
                fontSize: "11px",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {sopInputMode === "images" ? (
          <div key="images-form" style={cardStyle}>
            <label style={labelStyle}>Draft a new SOP from images</label>
            <p style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "14px", lineHeight: 1.6 }}>
              Upload a few images of the process (screenshots, photos of a
              whiteboard, a checklist, etc.) and add any notes for context.
              AI drafts a step-by-step SOP, which sits here for review before
              it can be approved and start shaping how the AI writes content.
            </p>
            <input
              type="file"
              aria-label="SOP source images"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setSopImages(Array.from(e.target.files || []))}
              style={{ marginBottom: "10px", fontSize: "12px" }}
            />
            {sopImages.length > 0 && (
              <div style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "10px" }}>
                {sopImages.length} image{sopImages.length > 1 ? "s" : ""} selected
              </div>
            )}
            <textarea
              placeholder="Notes about this process..."
              value={sopNotes}
              onChange={(e) => setSopNotes(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", marginBottom: "10px" }}
            />
            <button
              onClick={handleGenerateSop}
              disabled={generatingSop}
              style={{
                padding: "8px 16px",
                background: generatingSop ? "var(--gray-400)" : "var(--primary)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              {generatingSop ? "Drafting..." : "✦ Draft SOP"}
            </button>
          </div>
        ) : (
          <div key="manual-form" style={cardStyle}>
            <label style={labelStyle}>Add an SOP you already wrote</label>
            <p style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "14px", lineHeight: 1.6 }}>
              Paste it in directly — no AI drafting involved. It still lands
              in Pending below for a one-click approve, same as an
              AI-drafted one, before it can shape how the AI writes content.
            </p>
            <input
              placeholder="Title"
              value={manualSopTitle}
              onChange={(e) => setManualSopTitle(e.target.value)}
              style={{ ...inputStyle, marginBottom: "10px" }}
            />
            <textarea
              placeholder="Paste the SOP content here..."
              value={manualSopContent}
              onChange={(e) => setManualSopContent(e.target.value)}
              rows={8}
              style={{ ...inputStyle, resize: "vertical", marginBottom: "10px" }}
            />
            <button
              onClick={handleAddManualSop}
              disabled={addingManualSop}
              style={{
                padding: "8px 16px",
                background: addingManualSop ? "var(--gray-400)" : "var(--primary)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              {addingManualSop ? "Adding..." : "Add SOP"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
          {[
            { key: "pending_review", label: "Pending" },
            { key: "approved", label: "Approved" },
            { key: "rejected", label: "Rejected" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSopStatusFilter(s.key)}
              style={{
                padding: "5px 12px",
                borderRadius: "16px",
                border: "0.5px solid",
                borderColor: sopStatusFilter === s.key ? "var(--primary)" : "var(--gray-300)",
                background: sopStatusFilter === s.key ? "var(--primary)" : "transparent",
                color: sopStatusFilter === s.key ? "var(--white)" : "var(--gray-600)",
                fontSize: "11px",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loadingSops ? (
          <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
        ) : (
          sopDrafts
            .filter((d) => d.status === sopStatusFilter)
            .filter((d) => !isPendingDelete(d._id))
            .map((draft) => (
              <div key={draft._id} style={cardStyle}>
                {editingSopId === draft._id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input
                      style={inputStyle}
                      value={editSopTitle}
                      onChange={(e) => setEditSopTitle(e.target.value)}
                    />
                    <textarea
                      style={{ ...inputStyle, resize: "vertical" }}
                      rows={8}
                      value={editSopContent}
                      onChange={(e) => setEditSopContent(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleSaveSopEdit(draft._id)}
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
                        onClick={() => setEditingSopId(null)}
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
                  <>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--charcoal)", marginBottom: "8px" }}>
                      {draft.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--gray-600)", whiteSpace: "pre-wrap", marginBottom: "12px" }}>
                      {draft.content}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => startEditSop(draft)}
                        style={{
                          padding: "5px 12px",
                          background: "transparent",
                          color: "var(--gray-600)",
                          border: "0.5px solid var(--gray-300)",
                          borderRadius: "var(--border-radius)",
                          fontSize: "11px",
                        }}
                      >
                        ✎ Edit
                      </button>
                      <button
                        onClick={() => handleExportSop(draft, "internal")}
                        disabled={exportingSopId === draft._id}
                        style={{
                          padding: "5px 12px",
                          background: "transparent",
                          color: "var(--gray-600)",
                          border: "0.5px solid var(--gray-300)",
                          borderRadius: "var(--border-radius)",
                          fontSize: "11px",
                        }}
                      >
                        {exportingSopId === draft._id ? "Exporting..." : "⬇ Export (internal)"}
                      </button>
                      <button
                        onClick={() => handleExportSop(draft, "clean")}
                        disabled={exportingSopId === draft._id}
                        style={{
                          padding: "5px 12px",
                          background: "transparent",
                          color: "var(--gray-600)",
                          border: "0.5px solid var(--gray-300)",
                          borderRadius: "var(--border-radius)",
                          fontSize: "11px",
                        }}
                      >
                        {exportingSopId === draft._id ? "Exporting..." : "⬇ Export (clean)"}
                      </button>
                      {draft.status !== "approved" && (
                        <button
                          onClick={() => handleApproveSop(draft._id)}
                          style={{
                            padding: "5px 12px",
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
                      {draft.status !== "rejected" && rejectingSopId !== draft._id && (
                        <button
                          onClick={() => {
                            setRejectingSopId(draft._id);
                            setRejectNotes("");
                          }}
                          style={{
                            padding: "5px 12px",
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
                      {confirmDeleteSopId === draft._id ? (
                        <>
                          <button
                            onClick={() => handleDeleteSop(draft._id, draft.title)}
                            style={{
                              padding: "5px 12px",
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
                            onClick={() => setConfirmDeleteSopId(null)}
                            style={{
                              padding: "5px 12px",
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
                          onClick={() => setConfirmDeleteSopId(draft._id)}
                          style={{
                            padding: "5px 12px",
                            background: "transparent",
                            color: "var(--gray-500)",
                            border: "0.5px solid var(--gray-300)",
                            borderRadius: "var(--border-radius)",
                            fontSize: "11px",
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    {rejectingSopId === draft._id && (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <textarea
                          value={rejectNotes}
                          onChange={(e) => setRejectNotes(e.target.value)}
                          placeholder="Why is this being rejected? (optional — logged to the Feedback tab so future drafts don't repeat it)"
                          rows={2}
                          style={{ ...inputStyle, resize: "vertical", fontSize: "12px" }}
                        />
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => handleRejectSop(draft._id, rejectNotes)}
                            style={{
                              padding: "5px 12px",
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
                            onClick={() => setRejectingSopId(null)}
                            style={{
                              padding: "5px 12px",
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
                    )}
                  </>
                )}
              </div>
            ))
        )}
        {!loadingSops && sopDrafts.filter((d) => d.status === sopStatusFilter).length === 0 && (
          <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
            No {sopStatusFilter === "pending_review" ? "pending" : sopStatusFilter} SOPs.
          </div>
        )}
      </div>
      <UndoToastStack pending={pendingDeletes} onUndo={undoDelete} />
    </div>
  );
};

export default Sops;
