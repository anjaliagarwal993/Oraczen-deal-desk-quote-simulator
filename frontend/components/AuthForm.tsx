"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { login, register, toErrors } from "../lib/api";
import { getToken, setSession } from "../lib/auth";
import { setFlash } from "../lib/toast";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isLogin = mode === "login";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (getToken()) router.replace("/dashboard"); }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      const session = isLogin ? await login(email, password) : await register(name, email, password);
      setSession(session);
      setFlash(
        isLogin ? "Login successful" : "Account created",
        isLogin ? `Welcome back, ${session.user.name}! You are now logged in.` : `Welcome, ${session.user.name}! Your account is ready.`,
      );
      router.push("/dashboard"); // after login or sign-up, land on the dashboard
    } catch (err) {
      setErrors(toErrors(err).map((x) => x.message));
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-side">
        <Link href="/"><span className="brand-mark" aria-hidden="true">◈</span> Deal Desk</Link>
        <div>
          <h2>Quotes your finance team can trust.</h2>
          <ul>
            <li>Totals calculated by the API, never in the browser</li>
            <li>Approval reasons explained in plain English</li>
            <li>A full history of every status change</li>
          </ul>
        </div>
        <small>Prepared for the Oraczen take-home assignment</small>
      </aside>
      <div className="auth-main">
        <form className="auth-form" onSubmit={submit} noValidate>
          <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="sub">{isLogin ? "Log in to open your dashboard." : "It takes under a minute."}</p>
          {errors.length > 0 && <div className="errbox" role="alert">{errors.map((m) => <div key={m}>{m}</div>)}</div>}
          {!isLogin && (
            <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Asha Rao" /></label>
          )}
          <label>Work email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="name@company.com" /></label>
          <label className="pw">Password
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? "current-password" : "new-password"} />
            <button type="button" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
            {!isLogin && <span className="hint">At least 8 characters.</span>}
          </label>
          <button className="submit" disabled={busy}>{busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}</button>
          <p className="alt">
            {isLogin ? <>New here? <Link href="/register">Create an account</Link></> : <>Already registered? <Link href="/login">Log in</Link></>}
          </p>
        </form>
      </div>
    </div>
  );
}
