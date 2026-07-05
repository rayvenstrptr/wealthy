"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CalendarRange,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Settings,
} from "lucide-react";
import { useAddExpense } from "@/components/add-expense-provider";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: ReceiptText },
  { href: "/income", label: "Income", icon: Banknote },
  { href: "/events", label: "Events", icon: CalendarRange },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Text wordmark: "wealth" + a gold period. */
function Wordmark() {
  return (
    <Link href="/" className="text-base font-bold tracking-[-0.01em] text-foreground">
      wealth
      <span style={{ color: "oklch(0.62 0.10 85)" }}>.</span>
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { open } = useAddExpense();

  return (
    <>
      {/* Desktop top bar */}
      <header className="sticky top-0 z-40 hidden border-b border-border bg-background/85 backdrop-blur md:block">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-8 px-8">
          <Wordmark />
          <nav className="flex items-center gap-1.5 text-[13px]">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 transition-colors",
                    active
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={open}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4.5 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-[#3a362e] dark:hover:bg-[#e8e3d9]"
          >
            <Plus className="size-4" />
            Expense
          </button>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 px-1.5 pt-2 pb-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 text-[10px] font-semibold",
                  active ? "text-foreground" : "font-normal text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-[26px] w-11 items-center justify-center rounded-full transition-colors",
                    active && "bg-secondary"
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
