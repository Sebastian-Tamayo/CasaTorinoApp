import { ECOSISTEMA } from "@/lib/ecosistema";

type AppHeaderProps = {
  title?: string;
};

export function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/95 backdrop-blur-md">
      <div className="mx-auto flex h-header max-w-lg items-center gap-3 px-4 lg:max-w-3xl xl:max-w-5xl">
        <a
          href={ECOSISTEMA.gestionInterna}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-ink/15 bg-card text-ink shadow-tpv transition hover:border-oro/50 hover:bg-oro/10"
          aria-label="Salir a gestión interna"
          title="Gestión interna"
        >
          <span className="text-lg font-bold leading-none" aria-hidden="true">
            ←
          </span>
        </a>
        <div className="size-10 shrink-0 overflow-hidden rounded-full bg-card shadow-tpv">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpeg"
            alt="Casa Torino"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight text-ink">
            Casa Torino
          </p>
          {title ? (
            <p className="truncate text-xs font-medium text-ink/50">{title}</p>
          ) : (
            <p className="font-accent text-lg leading-none text-oro">
              ERP
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
