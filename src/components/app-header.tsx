type AppHeaderProps = {
  title?: string;
};

export function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/95 backdrop-blur-md">
      <div className="mx-auto flex h-header max-w-lg items-center gap-3 px-4">
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
            <p className="font-accent text-lg leading-none text-esmeralda">
              ERP
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
