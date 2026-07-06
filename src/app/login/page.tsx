import { LoginForm } from "@/components/login-form";

// The landing page for anyone not signed in (middleware routes them here).
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-7">
        <div className="space-y-2.5 text-center">
          <div className="text-[32px] font-bold tracking-[-0.02em]">
            wealth
            <span style={{ color: "oklch(0.62 0.10 85)" }}>.</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Income, envelopes, investments — one place for the whole picture.
          </p>
        </div>
        <div className="rounded-[20px] bg-card p-6 shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
          <LoginForm />
        </div>
        <p className="text-center text-[12px] text-muted-foreground">
          Sign in with your username and 4-digit PIN, or create an account.
        </p>
      </div>
    </main>
  );
}
