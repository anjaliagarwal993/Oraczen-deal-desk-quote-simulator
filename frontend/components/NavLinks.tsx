"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [["/dashboard", "Dashboard"], ["/quotes", "Saved quotes"], ["/compare", "Compare"]] as const;

/** Page links plus the primary "+ New quote" button. Active link = current path (usePathname). */
export default function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} onClick={onNavigate}
          className={path.startsWith(href) ? "on" : ""} aria-current={path.startsWith(href) ? "page" : undefined}>{label}</Link>
      ))}
      <Link href="/builder" onClick={onNavigate} className={path.startsWith("/builder") ? "nav-cta on" : "nav-cta"}>+ New quote</Link>
    </>
  );
}
