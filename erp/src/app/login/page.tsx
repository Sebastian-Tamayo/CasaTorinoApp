import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 h-20 w-20 overflow-hidden rounded-full border-2 border-oro/70 bg-card shadow-tpv">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpeg"
              alt="Casa Torino"
              className="h-full w-full object-cover"
            />
          </div>
          <h1 className="font-display text-3xl text-ink">Casa Torino</h1>
          <p className="mt-1 text-sm font-bold uppercase tracking-wide text-oro">
            Oficina · ERP
          </p>
          <p className="mt-3 text-sm text-ink/60">
            Recaudación del TPV, RRHH y gestiones del bar
          </p>
        </div>

        <div className="rounded-tpv-lg border border-ink/5 bg-card p-6 shadow-tpv-lg">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
