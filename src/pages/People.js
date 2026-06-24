import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";

const ROLES = ["host", "speaker", "leader", "member", "staff"];

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
  background: "var(--white)",
};

const cardStyle = {
  background: "var(--white)",
  border: "0.5px solid var(--gray-300)",
  borderRadius: "var(--border-radius-lg)",
  padding: "20px",
};

const sectionTitleStyle = {
  fontFamily: "Cinzel, serif",
  fontSize: "10px",
  fontWeight: "500",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--navy)",
  opacity: 0.7,
};

const emptyForm = { name: "", title: "", role: "member", email: "", bio: "" };

const People = () => {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get("/api/people");
      setPeople(res.data);
    } catch (err) {
      setError("Failed to load people");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const selectPerson = (person) => {
    setSelected(person);
    setForm({
      name: person.name || "",
      title: person.title || "",
      role: person.role || "member",
      email: person.email || "",
      bio: person.bio || "",
    });
    setError("");
  };

  const startNew = () => {
    setSelected("new");
    setForm(emptyForm);
    setError("");
  };

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (selected === "new") {
        const res = await client.post("/api/people", form);
        await fetchPeople();
        selectPerson(res.data);
      } else {
        const res = await client.put(`/api/people/${selected._id}`, form);
        await fetchPeople();
        selectPerson(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selected === "new" || !selected) return;
    try {
      await client.delete(`/api/people/${selected._id}`);
      setSelected(null);
      setForm(emptyForm);
      await fetchPeople();
    } catch (err) {
      setError("Failed to delete");
    }
  };

  const handleHeadshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || selected === "new" || !selected) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("headshot", file);
      const res = await client.post(
        `/api/people/${selected._id}/headshot`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      await fetchPeople();
      selectPerson(res.data.person);
    } catch (err) {
      setError(err.response?.data?.error || "Headshot upload failed");
    } finally {
      setUploading(false);
    }
  };

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
              color: "var(--navy)",
              letterSpacing: "0.04em",
              marginBottom: "4px",
            }}
          >
            People
          </h2>
          <p style={{ fontSize: "12px", color: "var(--gray-600)" }}>
            Hosts, speakers, and leaders for your flyers and content
          </p>
        </div>
        <button
          onClick={startNew}
          style={{
            padding: "8px 16px",
            background: "var(--navy)",
            color: "var(--white)",
            border: "none",
            borderRadius: "var(--border-radius)",
            fontSize: "12px",
            fontWeight: "500",
          }}
        >
          + Add person
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {loading ? (
            <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
              Loading roster...
            </div>
          ) : people.length === 0 ? (
            <div
              style={{
                ...cardStyle,
                textAlign: "center",
                color: "var(--gray-500)",
                fontSize: "12px",
              }}
            >
              No people yet. Add your first host or speaker.
            </div>
          ) : (
            people.map((p) => {
              const isSelected = selected !== "new" && selected?._id === p._id;
              return (
                <div
                  key={p._id}
                  onClick={() => selectPerson(p)}
                  style={{
                    border: `0.5px solid ${isSelected ? "var(--navy)" : "var(--gray-300)"}`,
                    borderRadius: "var(--border-radius-lg)",
                    padding: "14px",
                    display: "flex",
                    gap: "12px",
                    cursor: "pointer",
                    background: isSelected ? "#f4f8fb" : "var(--white)",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: "var(--gray-200)",
                      flexShrink: 0,
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--gray-500)",
                      fontSize: "16px",
                    }}
                  >
                    {p.headshot_url ? (
                      <img
                        src={p.headshot_url}
                        alt={p.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      p.name?.[0]?.toUpperCase() || "?"
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "var(--navy)",
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                      {p.title ? `${p.title} · ` : ""}
                      {p.role}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selected && (
          <div
            style={{
              ...cardStyle,
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              alignSelf: "start",
              position: "sticky",
              top: "0",
            }}
          >
            <div style={sectionTitleStyle}>
              {selected === "new" ? "New person" : "Edit person"}
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
                }}
              >
                {error}
              </div>
            )}

            {selected !== "new" && (
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: "var(--gray-200)",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--gray-500)",
                    fontSize: "22px",
                    flexShrink: 0,
                  }}
                >
                  {selected.headshot_url ? (
                    <img
                      src={selected.headshot_url}
                      alt={selected.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    selected.name?.[0]?.toUpperCase() || "?"
                  )}
                </div>
                <label
                  style={{
                    padding: "6px 12px",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "11px",
                    color: "var(--gray-600)",
                    cursor: "pointer",
                  }}
                >
                  {uploading ? "Uploading..." : "Upload headshot"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleHeadshotUpload}
                    disabled={uploading}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            )}

            <div>
              <label style={labelStyle}>Name</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={handleChange("name")}
                placeholder="Apostle Khy Traylor"
              />
            </div>

            <div>
              <label style={labelStyle}>Title</label>
              <input
                style={inputStyle}
                value={form.title}
                onChange={handleChange("title")}
                placeholder="Senior Pastor"
              />
            </div>

            <div>
              <label style={labelStyle}>Role</label>
              <select
                style={inputStyle}
                value={form.role}
                onChange={handleChange("role")}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                style={inputStyle}
                value={form.email}
                onChange={handleChange("email")}
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label style={labelStyle}>Bio</label>
              <textarea
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                rows={3}
                value={form.bio}
                onChange={handleChange("bio")}
              />
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                style={{
                  padding: "8px 16px",
                  background:
                    saving || !form.name.trim() ? "var(--gray-400)" : "var(--navy)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  fontSize: "12px",
                  fontWeight: "500",
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {selected !== "new" && (
                <button
                  onClick={handleDelete}
                  style={{
                    padding: "8px 16px",
                    background: "#fdf0f0",
                    color: "#c0504d",
                    border: "0.5px solid #e8b4b4",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                  }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => {
                  setSelected(null);
                  setForm(emptyForm);
                }}
                style={{
                  padding: "8px 16px",
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
        )}
      </div>
    </div>
  );
};

export default People;
