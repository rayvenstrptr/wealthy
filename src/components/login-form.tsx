"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const initialState: AuthState = { error: null };

/** 4-digit PIN field: numeric keyboard, masked, digits only. */
function PinInput({ id, name, label }: { id: string; name: string; label: string }) {
  const [pin, setPin] = useState("");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        required
        maxLength={4}
        pattern="[0-9]{4}"
        placeholder="••••"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="text-center font-semibold tracking-[0.5em]"
      />
    </div>
  );
}

/** Username + 4-digit PIN, with a sign-in / create-account toggle. */
export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  const creating = mode === "create";
  const state = creating ? signUpState : signInState;
  const pending = creating ? signUpPending : signInPending;

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1 text-[13px]">
        {(
          [
            ["signin", "Sign in"],
            ["create", "Create account"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              "rounded-full py-1.5 transition-colors",
              mode === value
                ? "bg-background font-medium text-foreground shadow-[0_1px_2px_rgba(38,35,30,0.08)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        key={mode} // reset fields when switching modes
        action={creating ? signUpAction : signInAction}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="ray"
          />
        </div>
        <PinInput id="pin" name="pin" label="4-digit PIN" />
        {creating && <PinInput id="pin_confirm" name="pin_confirm" label="Confirm PIN" />}
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? creating
              ? "Creating account…"
              : "Signing in…"
            : creating
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
