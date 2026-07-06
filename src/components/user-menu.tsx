"use client";

import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { CircleUserRound, FileUp, LogOut, Settings } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const itemClass =
  "flex w-full cursor-default items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] outline-none select-none data-highlighted:bg-secondary";

/** Top-right username chip → Settings / Import / Log out. */
export function UserMenu({ username }: { username: string }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="inline-flex max-w-40 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground">
        <CircleUserRound className="size-[18px] shrink-0" />
        <span className="truncate">{username}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="isolate z-50" sideOffset={6} align="end">
          <Menu.Popup className="isolate z-50 min-w-44 origin-(--transform-origin) rounded-[14px] bg-popover p-1 text-popover-foreground shadow-[0_8px_28px_rgba(38,35,30,0.14)] ring-1 ring-foreground/5 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Menu.Item
              render={<Link href="/settings" />}
              className={cn(itemClass, "cursor-pointer")}
            >
              <Settings className="size-4 text-muted-foreground" />
              Settings
            </Menu.Item>
            <Menu.Item render={<Link href="/import" />} className={cn(itemClass, "cursor-pointer")}>
              <FileUp className="size-4 text-muted-foreground" />
              Import
            </Menu.Item>
            <div className="mx-2 my-1 h-px bg-border" />
            <Menu.Item onClick={() => signOut()} className={cn(itemClass, "cursor-pointer")}>
              <LogOut className="size-4 text-muted-foreground" />
              Log out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
