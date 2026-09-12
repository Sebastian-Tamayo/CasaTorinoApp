"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, PlusCircle, User } from "lucide-react";

const items = [
  { href: "/gestion", label: "Inicio", icon: Home, exact: true },
  { href: "/gestion/nuevo", label: "Registrar", icon: PlusCircle, exact: false },
  { href: "/gestion/mas", label: "Módulos", icon: LayoutGrid, exact: false },
  { href: "/gestion/perfil", label: "Perfil", icon: User, exact: false },
] as const;

const erpPaths = [
  "/gestion/mas",
  "/gestion/historial",
  "/gestion/documentos",
  "/gestion/proveedores",
  "/gestion/rrhh",
  "/gestion/fiscal",
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink/10 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="mx-auto flex h-nav max-w-lg items-stretch justify-around px-1">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : href === "/gestion/mas"
              ? erpPaths.some(
                  (p) => pathname === p || pathname.startsWith(`${p}/`),
                )
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${
                  active
                    ? "text-azul-colombia"
                    : "text-ink/45 active:text-ink/70"
                }`}
              >
                <Icon
                  className="size-6"
                  strokeWidth={active ? 2.4 : 1.8}
                  aria-hidden
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
