import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { RequirePinGate } from "@/components/require-pin-gate";
import { ToastHost } from "@/components/toast";

export default function GestionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequirePinGate>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-cream lg:max-w-3xl xl:max-w-5xl">
        <AppHeader />
        <main className="flex-1 px-3 pb-[calc(var(--spacing-nav)+1.5rem)] pt-3 sm:px-4 sm:pt-4">
          {children}
        </main>
        <BottomNav />
        <ToastHost />
      </div>
    </RequirePinGate>
  );
}
