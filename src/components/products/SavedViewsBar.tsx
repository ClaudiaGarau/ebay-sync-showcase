import { useState } from "react";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { SavedView } from "@/components/data-table";
import type { ProductFilters } from "./filters";

interface SavedViewsBarProps {
  statusFilter: ProductFilters["status"];
  onStatusFilterChange: (status: ProductFilters["status"]) => void;
  savedViews: SavedView<ProductFilters>[];
  activeSavedViewId?: string;
  onApplySavedView: (view: SavedView<ProductFilters>) => void;
  onSaveCurrentView: (name: string) => void;
  onDeleteSavedView: (id: string) => void;
}

function SaveViewPopover({ onSave }: { onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Star className="size-3.5" />
          Salva vista
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2.5">
        <p className="text-xs font-medium text-foreground">Salva la vista corrente</p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Es. "Margini bassi eBay"'
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              onSave(name.trim());
              setName("");
              setOpen(false);
            }
          }}
        />
        <Button
          size="sm"
          className="w-full"
          disabled={!name.trim()}
          onClick={() => {
            onSave(name.trim());
            setName("");
            setOpen(false);
          }}
        >
          Salva
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function SavedViewsBar({
  statusFilter,
  onStatusFilterChange,
  savedViews,
  activeSavedViewId,
  onApplySavedView,
  onSaveCurrentView,
  onDeleteSavedView,
}: SavedViewsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as ProductFilters["status"])}>
        <TabsList>
          <TabsTrigger value="all">Tutti</TabsTrigger>
          <TabsTrigger value="active">Attivi</TabsTrigger>
          <TabsTrigger value="draft">Bozze</TabsTrigger>
          <TabsTrigger value="archived">Archiviati</TabsTrigger>
        </TabsList>
      </Tabs>

      {savedViews.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {savedViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => onApplySavedView(view)}
              className={cn(
                "group/view flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
                activeSavedViewId === view.id && "border-primary/60 bg-primary/5 text-foreground",
              )}
            >
              {view.name}
              <X
                className="size-3 opacity-0 transition-opacity group-hover/view:opacity-60 hover:!opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSavedView(view.id);
                }}
              />
            </button>
          ))}
        </div>
      )}

      <SaveViewPopover onSave={onSaveCurrentView} />
    </div>
  );
}
