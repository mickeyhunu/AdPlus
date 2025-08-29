import React, { useState } from "react";
import { login } from "../api";

export default function Login({ onLogin }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const { data } = await login(username, password);
      onLogin(data.token);
    } catch (e) {
      setErr(e.response?.data?.message || "Login failed");
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "10vh auto", fontFamily: "sans-serif" }}>
      <h2>AdPlus 로그인</h2>
      <form onSubmit={submit}>
        <input placeholder="username" value={username} onChange={e=>setU(e.target.value)} style={{ width:"100%", padding:8, margin:"8px 0" }} />
        <input placeholder="password" type="password" value={password} onChange={e=>setP(e.target.value)} style={{ width:"100%", padding:8, margin:"8px 0" }} />
        <button style={{ width:"100%", padding:10 }}>로그인</button>
      </form>
      {err && <p style={{ color:"crimson" }}>{err}</p>}
    </div>
  );
}
