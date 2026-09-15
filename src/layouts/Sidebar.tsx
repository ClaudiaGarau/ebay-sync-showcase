import { Palette } from "lucide-react";
import { NavLink } from "react-router-dom";
import { navItems } from "@/nav";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-sidebar p-3 text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-2 pb-5 pt-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
          E
        </span>
        <span className="text-[15px] font-semibold tracking-tight">
          EbaySync
        </span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-sidebar-foreground/70 transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                isActive &&
                  "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
              )
            }
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-2 pt-2">
        <Separator className="bg-sidebar-border" />
        <NavLink
          to="/design-system"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-sidebar-foreground/50 transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-foreground/80",
              isActive && "text-sidebar-foreground/80",
            )
          }
        >
          <Palette className="size-3.5 shrink-0" strokeWidth={1.8} />
          <span>Design System</span>
        </NavLink>
      </div>
    </aside>
  );
}
