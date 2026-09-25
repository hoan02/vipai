"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHead, Pill } from "@/components/dashboard/kit";
import { members as seedMembers, type Member } from "@/lib/dashboard-data";

export function MembersView() {
  const [list, setList] = useState<Member[]>(seedMembers);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("Developer");

  const invite = () => {
    const value = email.trim();
    if (!value) return;
    setList((l) => [...l, { email: value, role, used: "$0.00", cap: "Not set", pct: 0 }]);
    setEmail("");
    setInviting(false);
  };

  return (
    <>
      <PageHead
        title="Members"
        sub="People with access to this organization and their role."
        side={
          !inviting ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={() => setInviting(true)}>
              <Plus size={15} /> Invite member
            </button>
          ) : undefined
        }
      />

      {inviting ? (
        <div className="panel" style={{ padding: 16, marginTop: 18 }}>
          <label className="note" htmlFor="inviteEmail" style={{ display: "block", marginBottom: 6 }}>
            Email address
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              id="inviteEmail"
              className="field"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ flex: "1 1 240px" }}
            />
            <select className="field" value={role} onChange={(e) => setRole(e.target.value as Member["role"])} aria-label="Role">
              <option value="Admin">Admin</option>
              <option value="Developer">Developer</option>
              <option value="Viewer">Viewer</option>
            </select>
            <button className="btn btn-primary btn-sm" type="button" onClick={invite}>
              Send invite
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => {
                setInviting(false);
                setEmail("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="twrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th className="r">Used</th>
                <th className="r">Monthly cap</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.email}>
                  <td>{m.email}</td>
                  <td>
                    <Pill tone="role">{m.role}</Pill>
                  </td>
                  <td className="r num">{m.used}</td>
                  <td className="r num">{m.cap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
