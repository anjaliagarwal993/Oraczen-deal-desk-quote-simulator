"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getToken, getUser } from "../lib/auth";
import type { AuthUser } from "../lib/types";
import { setFlash } from "../lib/toast";
import NavLinks from "./NavLinks";
import ToastHost from "./ToastHost";

/** Wraps every signed-in page: sends visitors without a login to /login. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);   // mobile menu
  const [userOpen, setUserOpen] = useState(false);   // user dropdown

  useEffect(() => {
    const u = getUser();
    if (!getToken() || !u) { router.replace("/login"); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;
  const logout = () => { clearSession(); setFlash("Logged out", "You have been logged out safely."); router.push("/"); };
  return (
    <>
      <header className="nav no-print">
        <Link href="/dashboard" className="logo"><span className="brand-mark" aria-hidden="true">◈</span>Deal Desk</Link>
        <button className="menu-btn" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Main">
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </nav>
        <div className="user-menu">
          <button className="user-btn" aria-haspopup="true" aria-expanded={userOpen} onClick={() => setUserOpen(!userOpen)}>
            <span className="avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
            <span className="user-name">{user.name}</span> ▾
          </button>
          {userOpen && (
            <div className="user-pop">
              <small className="muted">{user.email}</small>
              <button onClick={logout}>Log out</button>
            </div>
          )}
        </div>
      </header>
      <ToastHost />
      <main>{children}</main>
    </>
  );
}
