import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { ToastHost } from "@/components/toast";

export default function GestionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-cream">
      <AppHeader />
      <main className="flex-1 px-4 pb-[calc(var(--spacing-nav)+1.5rem)] pt-4">
        {children}
      </main>
      <BottomNav />
      <ToastHost />
    </div>
  );
}
