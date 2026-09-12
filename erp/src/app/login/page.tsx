import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 h-20 w-20 overflow-hidden rounded-full bg-card shadow-tpv">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpeg"
              alt="Casa Torino"
              className="h-full w-full object-cover"
            />
          </div>
          <h1 className="font-display text-3xl text-ink">Casa Torino</h1>
          <p className="mt-1 font-accent text-2xl text-esmeralda">Gestión</p>
          <p className="mt-3 text-sm text-ink/60">
            Acceso exclusivo del equipo
          </p>
        </div>

        <div className="rounded-tpv-lg bg-card p-6 shadow-tpv">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
