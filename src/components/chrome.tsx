"use client";

import { usePathname } from "next/navigation";

import { Footer } from "./footer";
import { Navbar } from "./navbar";

/**
 * App chrome (navbar + footer) for the consumer site. The operator console
 * (/admin) is a back-office surface and renders without it.
 */
export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOps = pathname.startsWith("/admin");

  if (isOps) return <>{children}</>;

  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
