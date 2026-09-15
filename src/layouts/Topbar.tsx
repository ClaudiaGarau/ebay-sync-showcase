import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { navItems } from "@/nav";
import { account } from "@/mocks";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const accountInitials = account.name
  .split(" ")
  .map((part) => part[0])
  .join("")
  .slice(0, 2)
  .toUpperCase();

export default function Topbar() {
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();
  const current = navItems.find((item) =>
    item.path === "/" ? pathname === "/" : pathname.startsWith(item.path),
  );

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <h1 className="text-[15px] font-semibold text-foreground">
        {current?.label ?? ""}
      </h1>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="size-8 cursor-pointer outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50">
            <AvatarFallback className="bg-secondary text-xs font-medium text-secondary-foreground">
              {accountInitials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium text-foreground">{account.name}</p>
            <p className="truncate text-xs text-muted-foreground">{account.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Settings />
              Impostazioni
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light">
              <Sun />
              Chiaro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon />
              Scuro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor />
              Sistema
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <LogOut />
            Esci
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
