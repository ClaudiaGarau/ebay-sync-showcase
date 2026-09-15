import { useState } from "react";
import {
  Archive,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PriceChange } from "@/services/products";
import type { ProductStatus } from "@/types";

interface Option {
  id: string;
  label: string;
}

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  suppliers: Option[];
  onChangeStatus: (status: ProductStatus) => void;
  onPriceChange: (change: PriceChange) => void;
  onMarginTarget: (percent: number) => void;
  onAssignSupplier: (supplierId: string | undefined) => void;
  onAddTags: (tags: string[]) => void;
  onSync: () => void;
  onDuplicate: () => void;
  onExportCsv: () => void;
  onArchive: () => void;
  onDelete: () => void;
  busy?: boolean;
}

function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function PricePopover({ onApply }: { onApply: (change: PriceChange) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PriceChange["mode"]>("increase_percent");
  const [value, setValue] = useState("10");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Prezzo
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2.5">
        <p className="text-xs font-medium text-foreground">Modifica prezzo in blocco</p>
        <Select value={mode} onValueChange={(v) => setMode(v as PriceChange["mode"])}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="set">Imposta a</SelectItem>
            <SelectItem value="increase_percent">Aumenta del %</SelectItem>
            <SelectItem value="decrease_percent">Riduci del %</SelectItem>
            <SelectItem value="increase_amount">Aumenta di €</SelectItem>
            <SelectItem value="decrease_amount">Riduci di €</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Valore"
        />
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            const parsed = Number.parseFloat(value.replace(",", "."));
            if (!Number.isFinite(parsed)) return;
            onApply({ mode, value: parsed } as PriceChange);
            setOpen(false);
          }}
        >
          Applica a selezionati
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function MarginPopover({ onApply }: { onApply: (percent: number) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("30");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Margine
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-2.5">
        <p className="text-xs font-medium text-foreground">Imposta margine target</p>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Il prezzo viene ricalcolato dal costo per raggiungere il margine indicato.
        </p>
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            const parsed = Number.parseFloat(value.replace(",", "."));
            if (!Number.isFinite(parsed)) return;
            onApply(parsed);
            setOpen(false);
          }}
        >
          Applica a selezionati
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function SupplierPopover({
  suppliers,
  onApply,
}: {
  suppliers: Option[];
  onApply: (supplierId: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Fornitore
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2.5">
        <p className="text-xs font-medium text-foreground">Assegna fornitore</p>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Scegli fornitore…" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="w-full"
          disabled={!selected}
          onClick={() => {
            onApply(selected);
            setOpen(false);
          }}
        >
          Applica a selezionati
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function TagsPopover({ onApply }: { onApply: (tags: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <TagIcon className="size-3.5" />
          Tag
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2.5">
        <p className="text-xs font-medium text-foreground">Aggiungi tag</p>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="tag1, tag2…"
        />
        <Button
          size="sm"
          className="w-full"
          disabled={!value.trim()}
          onClick={() => {
            onApply(parseTagsInput(value));
            setValue("");
            setOpen(false);
          }}
        >
          Aggiungi a selezionati
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function BulkActionBar({
  selectedCount,
  onClear,
  suppliers,
  onChangeStatus,
  onPriceChange,
  onMarginTarget,
  onAssignSupplier,
  onAddTags,
  onSync,
  onDuplicate,
  onExportCsv,
  onArchive,
  onDelete,
  busy,
}: BulkActionBarProps) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Annulla selezione">
        <X className="size-4" />
      </Button>
      <span className="text-sm font-medium text-foreground">{selectedCount} selezionati</span>

      <div className="mx-1 h-5 w-px bg-border" />

      {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Stato
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onChangeStatus("active")}>Attivo</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChangeStatus("draft")}>Bozza</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChangeStatus("archived")}>Archiviato</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PricePopover onApply={onPriceChange} />
      <MarginPopover onApply={onMarginTarget} />
      <SupplierPopover suppliers={suppliers} onApply={onAssignSupplier} />
      <TagsPopover onApply={onAddTags} />

      <Button variant="outline" size="sm" onClick={onSync}>
        <RefreshCw className="size-3.5" />
        Sincronizza
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Altro
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="size-3.5" />
            Duplica
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportCsv}>
            <Download className="size-3.5" />
            Esporta CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)}>
          <Archive className="size-3.5" />
          Archivia
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-3.5" />
          Elimina
        </Button>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archiviare ${selectedCount} prodotti?`}
        description="I prodotti archiviati non saranno più modificabili in blocco dalle viste attive, ma restano nel catalogo."
        confirmLabel="Archivia"
        onConfirm={() => {
          onArchive();
          setConfirmArchive(false);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Eliminare ${selectedCount} prodotti?`}
        description="I prodotti e le relative inserzioni collegate verranno rimossi. Potrai annullare subito dopo con l'apposito comando."
        confirmLabel="Elimina"
        variant="destructive"
        onConfirm={() => {
          onDelete();
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
