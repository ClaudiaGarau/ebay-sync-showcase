import { useState } from "react";
import { ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatMoney, formatPercent } from "@/lib/format";
import { countActiveAdvancedFilters, type ProductFilters } from "./filters";

interface Option {
  id: string;
  label: string;
}

interface FilterPanelProps {
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  suppliers: Option[];
  categories: string[];
  marketplaces: Option[];
  tags: string[];
  priceBounds: [number, number];
  marginBounds: [number, number];
  stockBounds: [number, number];
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function CheckboxGroup({
  options,
  selected,
  onToggle,
}: {
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) {
    return <p className="px-1 text-xs text-muted-foreground">Nessuna opzione disponibile.</p>;
  }
  return (
    <div className="space-y-1">
      {options.map((opt) => (
        <div key={opt.id} className="flex items-center gap-2 px-1">
          <Checkbox
            id={`filter-${opt.id}`}
            checked={selected.includes(opt.id)}
            onCheckedChange={() => onToggle(opt.id)}
          />
          <Label htmlFor={`filter-${opt.id}`} className="flex-1 cursor-pointer truncate font-normal">
            {opt.label}
          </Label>
        </div>
      ))}
    </div>
  );
}

export function FilterPanel({
  filters,
  onChange,
  suppliers,
  categories,
  marketplaces,
  tags,
  priceBounds,
  marginBounds,
  stockBounds,
}: FilterPanelProps) {
  const [priceDraft, setPriceDraft] = useState<[number, number]>(filters.priceRange ?? priceBounds);
  const [marginDraft, setMarginDraft] = useState<[number, number]>(filters.marginRange ?? marginBounds);
  const [stockDraft, setStockDraft] = useState<[number, number]>(filters.stockRange ?? stockBounds);

  const activeCount = countActiveAdvancedFilters(filters);
  const categoryOptions: Option[] = categories.map((c) => ({ id: c, label: c }));
  const tagOptions: Option[] = tags.map((t) => ({ id: t, label: t }));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <ListFilter className="size-3.5" />
          Filtri avanzati
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-[min(32rem,var(--radix-popover-content-available-height))] w-80 flex-col p-0"
      >
        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          <div className="space-y-4 p-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Fornitore</p>
              <CheckboxGroup
                options={suppliers}
                selected={filters.supplierIds}
                onToggle={(id) => onChange({ ...filters, supplierIds: toggle(filters.supplierIds, id) })}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Categoria</p>
              <CheckboxGroup
                options={categoryOptions}
                selected={filters.categories}
                onToggle={(id) => onChange({ ...filters, categories: toggle(filters.categories, id) })}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Marketplace</p>
              <CheckboxGroup
                options={marketplaces}
                selected={filters.marketplaceIds}
                onToggle={(id) => onChange({ ...filters, marketplaceIds: toggle(filters.marketplaceIds, id) })}
              />
            </div>

            {tagOptions.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Tag</p>
                  <CheckboxGroup
                    options={tagOptions}
                    selected={filters.tags}
                    onToggle={(id) => onChange({ ...filters, tags: toggle(filters.tags, id) })}
                  />
                </div>
              </>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Prezzo</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney({ amount: priceDraft[0], currency: "EUR" })} – {formatMoney({ amount: priceDraft[1], currency: "EUR" })}
                </p>
              </div>
              <Slider
                min={priceBounds[0]}
                max={priceBounds[1]}
                step={1}
                value={priceDraft}
                onValueChange={(v) => setPriceDraft([v[0], v[1]])}
                onValueCommit={(v) => onChange({ ...filters, priceRange: [v[0], v[1]] })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Margine</p>
                <p className="text-xs text-muted-foreground">
                  {formatPercent(marginDraft[0])} – {formatPercent(marginDraft[1])}
                </p>
              </div>
              <Slider
                min={marginBounds[0]}
                max={marginBounds[1]}
                step={1}
                value={marginDraft}
                onValueChange={(v) => setMarginDraft([v[0], v[1]])}
                onValueCommit={(v) => onChange({ ...filters, marginRange: [v[0], v[1]] })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Scorte</p>
                <p className="text-xs text-muted-foreground">
                  {stockDraft[0]} – {stockDraft[1]} pz
                </p>
              </div>
              <Slider
                min={stockBounds[0]}
                max={stockBounds[1]}
                step={1}
                value={stockDraft}
                onValueChange={(v) => setStockDraft([v[0], v[1]])}
                onValueCommit={(v) => onChange({ ...filters, stockRange: [v[0], v[1]] })}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label htmlFor="filter-issues" className="text-xs font-medium text-foreground">
                Solo prodotti con problemi
              </Label>
              <Switch
                id="filter-issues"
                checked={filters.onlyIssues}
                onCheckedChange={(checked) => onChange({ ...filters, onlyIssues: checked })}
              />
            </div>
          </div>
        </ScrollArea>
        {activeCount > 0 && (
          <div className="shrink-0 border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => {
                setPriceDraft(priceBounds);
                setMarginDraft(marginBounds);
                setStockDraft(stockBounds);
                onChange({
                  ...filters,
                  supplierIds: [],
                  categories: [],
                  marketplaceIds: [],
                  tags: [],
                  priceRange: null,
                  marginRange: null,
                  stockRange: null,
                  onlyIssues: false,
                });
              }}
            >
              Cancella filtri avanzati
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
