import { FileText, ListChecks, Plus, ReceiptText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldInput, FieldRow, FieldTextarea, Section, formatSAR } from "../ui-primitives";
import type {
  QuotePricingSummary,
  QuoteServiceScope,
  QuoteSummary,
  QuoteTermsAssumptionsExclusions,
  QuoteVersion,
  PnlVersion,
} from "../proposal-workspace-state";

export function QuoteSummaryTab({
  data,
  onChange,
}: {
  data: QuoteSummary;
  onChange: (d: QuoteSummary) => void;
}) {
  const update = (field: keyof QuoteSummary, value: string) => onChange({ ...data, [field]: value });
  const captured = Object.values(data).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Quote Summary</span>
        <Badge variant="outline" className="text-[9px]">{captured}/8 captured</Badge>
      </div>
      <Section title="Quote Context" defaultOpen icon={<FileText className="h-4 w-4 text-[#075eea]" />}>
        <div className="grid gap-x-4 lg:grid-cols-2">
          <FieldRow label="Quote Title"><FieldInput value={data.quoteTitle} onChange={v => update("quoteTitle", v)} placeholder="Working quote title" /></FieldRow>
          <FieldRow label="Quote Date"><FieldInput type="date" value={data.quoteDate} onChange={v => update("quoteDate", v)} /></FieldRow>
          <FieldRow label="Owner"><FieldInput value={data.quoteOwner} onChange={v => update("quoteOwner", v)} placeholder="Commercial owner" /></FieldRow>
          <FieldRow label="Version"><FieldInput value={data.quoteVersion} onChange={v => update("quoteVersion", v)} placeholder="e.g. v1" /></FieldRow>
          <FieldRow label="Customer"><FieldInput value={data.customerName} onChange={v => update("customerName", v)} placeholder="Customer / company name" /></FieldRow>
          <FieldRow label="Services"><FieldInput value={data.quotedServices} onChange={v => update("quotedServices", v)} placeholder="Warehousing, transport, VAS..." /></FieldRow>
        </div>
        <FieldRow label="Summary"><FieldTextarea value={data.quoteNarrative} onChange={v => update("quoteNarrative", v)} placeholder="Human-written quote summary that will feed the proposal." rows={3} /></FieldRow>
        <FieldRow label="Internal Notes"><FieldTextarea value={data.internalNotes} onChange={v => update("internalNotes", v)} placeholder="Internal quote notes. Not customer-facing unless reused later." rows={3} /></FieldRow>
      </Section>
    </div>
  );
}

export function QuoteServiceScopeTab({
  data,
  onChange,
}: {
  data: QuoteServiceScope;
  onChange: (d: QuoteServiceScope) => void;
}) {
  const update = (field: keyof QuoteServiceScope, value: string) => onChange({ ...data, [field]: value });
  const captured = Object.values(data).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Service Scope</span>
        <Badge variant="outline" className="text-[9px]">{captured}/6 captured</Badge>
      </div>
      <Section title="Quoted Scope" defaultOpen icon={<ListChecks className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Included"><FieldTextarea value={data.includedServices} onChange={v => update("includedServices", v)} placeholder="Services included in the quote." rows={3} /></FieldRow>
        <FieldRow label="Excluded"><FieldTextarea value={data.excludedServices} onChange={v => update("excludedServices", v)} placeholder="Services excluded from the quote." rows={3} /></FieldRow>
        <FieldRow label="Locations"><FieldTextarea value={data.serviceLocations} onChange={v => update("serviceLocations", v)} placeholder="Sites, cities, lanes, warehouses, and service locations." rows={3} /></FieldRow>
        <FieldRow label="Service Levels"><FieldTextarea value={data.serviceLevels} onChange={v => update("serviceLevels", v)} placeholder="Quote-level service levels, operating windows, or KPI references." rows={3} /></FieldRow>
        <FieldRow label="Customer"><FieldTextarea value={data.customerResponsibilities} onChange={v => update("customerResponsibilities", v)} placeholder="Customer responsibilities for this quote." rows={3} /></FieldRow>
        <FieldRow label="Hala"><FieldTextarea value={data.halaResponsibilities} onChange={v => update("halaResponsibilities", v)} placeholder="Hala responsibilities for this quote." rows={3} /></FieldRow>
      </Section>
    </div>
  );
}

export function QuotePricingSummaryTab({
  data,
  onChange,
  workingPnl,
}: {
  data: QuotePricingSummary;
  onChange: (d: QuotePricingSummary) => void;
  workingPnl?: PnlVersion;
}) {
  const update = (field: keyof QuotePricingSummary, value: string | number) => onChange({ ...data, [field]: value });
  const captured = [
    data.linkedPnlVersionName,
    data.totalRevenue,
    data.totalCost,
    data.grossProfit,
    data.grossProfitPercent,
    data.pricingSummary,
    data.pricingTableNotes,
  ].filter(Boolean).length;
  const carryForwardPnl = () => {
    if (!workingPnl) return;
    const totalRevenue = workingPnl.revenue.reduce((sum, line) => sum + line.amount, 0);
    const directCost = workingPnl.costs.reduce((sum, line) => sum + line.amount, 0);
    const totalCost = directCost * (1 + workingPnl.overheadPercent / 100);
    const grossProfit = totalRevenue - totalCost;
    onChange({
      ...data,
      linkedPnlVersionId: workingPnl.id,
      linkedPnlVersionName: workingPnl.name,
      totalRevenue,
      totalCost,
      grossProfit,
      grossProfitPercent: totalRevenue > 0 ? grossProfit / totalRevenue * 100 : 0,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ReceiptText className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Pricing Summary</span>
        <Badge variant="outline" className="text-[9px]">{captured}/7 captured</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</p>
          <p className="mt-1 text-sm font-semibold">{formatSAR(data.totalRevenue)}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Cost</p>
          <p className="mt-1 text-sm font-semibold">{formatSAR(data.totalCost)}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">GP</p>
          <p className="mt-1 text-sm font-semibold">{formatSAR(data.grossProfit)}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">GP%</p>
          <p className="mt-1 text-sm font-semibold">{data.grossProfitPercent.toFixed(1)}%</p>
        </div>
      </div>
      <Section title="Quote Pricing" defaultOpen icon={<ReceiptText className="h-4 w-4 text-[#075eea]" />}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 p-3">
          <div>
            <p className="text-xs font-semibold">Working P&amp;L carry-forward</p>
            <p className="text-[11px] text-muted-foreground">
              {workingPnl ? `${workingPnl.name} is available to copy into this quote.` : "Select a working scenario in P&L / Pricing first."}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={carryForwardPnl} disabled={!workingPnl}>
            Use Working P&amp;L
          </Button>
        </div>
        <div className="grid gap-x-4 lg:grid-cols-2">
          <FieldRow label="P&L ID"><FieldInput value={data.linkedPnlVersionId} onChange={v => update("linkedPnlVersionId", v)} placeholder="Linked working P&L version ID" /></FieldRow>
          <FieldRow label="P&L Name"><FieldInput value={data.linkedPnlVersionName} onChange={v => update("linkedPnlVersionName", v)} placeholder="Linked working P&L version name" /></FieldRow>
          <FieldRow label="Revenue"><FieldInput type="number" value={data.totalRevenue} onChange={v => update("totalRevenue", Number(v))} /></FieldRow>
          <FieldRow label="Cost"><FieldInput type="number" value={data.totalCost} onChange={v => update("totalCost", Number(v))} /></FieldRow>
          <FieldRow label="GP"><FieldInput type="number" value={data.grossProfit} onChange={v => update("grossProfit", Number(v))} /></FieldRow>
          <FieldRow label="GP%"><FieldInput type="number" value={data.grossProfitPercent} onChange={v => update("grossProfitPercent", Number(v))} /></FieldRow>
        </div>
        <FieldRow label="Summary"><FieldTextarea value={data.pricingSummary} onChange={v => update("pricingSummary", v)} placeholder="Human quote pricing summary." rows={3} /></FieldRow>
        <FieldRow label="Table Notes"><FieldTextarea value={data.pricingTableNotes} onChange={v => update("pricingTableNotes", v)} placeholder="Notes for quote pricing table or commercial pack." rows={3} /></FieldRow>
      </Section>
    </div>
  );
}

export function QuoteTermsAssumptionsExclusionsTab({
  data,
  onChange,
}: {
  data: QuoteTermsAssumptionsExclusions;
  onChange: (d: QuoteTermsAssumptionsExclusions) => void;
}) {
  const update = (field: keyof QuoteTermsAssumptionsExclusions, value: string) => onChange({ ...data, [field]: value });
  const captured = Object.values(data).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Terms / Assumptions / Exclusions</span>
        <Badge variant="outline" className="text-[9px]">{captured}/8 captured</Badge>
      </div>
      <Section title="Quote Terms" defaultOpen icon={<FileText className="h-4 w-4 text-[#075eea]" />}>
        <div className="grid gap-x-4 lg:grid-cols-2">
          <FieldRow label="Payment"><FieldInput value={data.paymentTerms} onChange={v => update("paymentTerms", v)} placeholder="Quote payment terms" /></FieldRow>
          <FieldRow label="Validity"><FieldInput value={data.validity} onChange={v => update("validity", v)} placeholder="Quote validity" /></FieldRow>
          <FieldRow label="Contract Term"><FieldInput value={data.contractTerm} onChange={v => update("contractTerm", v)} placeholder="Contract term / duration" /></FieldRow>
          <FieldRow label="VAT"><FieldInput value={data.vat} onChange={v => update("vat", v)} placeholder="VAT treatment" /></FieldRow>
        </div>
        <FieldRow label="Assumptions"><FieldTextarea value={data.assumptions} onChange={v => update("assumptions", v)} placeholder="Quote assumptions." rows={3} /></FieldRow>
        <FieldRow label="Exclusions"><FieldTextarea value={data.exclusions} onChange={v => update("exclusions", v)} placeholder="Quote exclusions." rows={3} /></FieldRow>
        <FieldRow label="Dependencies"><FieldTextarea value={data.dependencies} onChange={v => update("dependencies", v)} placeholder="Quote dependencies." rows={3} /></FieldRow>
        <FieldRow label="Risk Notes"><FieldTextarea value={data.riskNotes} onChange={v => update("riskNotes", v)} placeholder="Quote risk notes." rows={3} /></FieldRow>
      </Section>
    </div>
  );
}

export function QuoteVersionsTab({
  data,
  onChange,
}: {
  data: QuoteVersion[];
  onChange: (d: QuoteVersion[]) => void;
}) {
  const add = () => onChange([
    ...data,
    {
      id: `quote-version-${Date.now()}`,
      versionLabel: "",
      createdAt: "",
      status: "",
      notes: "",
    },
  ]);
  const update = (index: number, field: keyof QuoteVersion, value: string) => onChange(data.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Quote Versions</span>
          <Badge variant="outline" className="text-[9px]">{data.length} versions</Badge>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Version</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No quote versions captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((version, index) => (
            <div key={version.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[1fr_140px_120px_32px]">
                <FieldInput value={version.versionLabel} onChange={v => update(index, "versionLabel", v)} placeholder="Version label" />
                <FieldInput type="date" value={version.createdAt} onChange={v => update(index, "createdAt", v)} />
                <FieldInput value={version.status} onChange={v => update(index, "status", v)} placeholder="Status" />
                <button type="button" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2">
                <FieldTextarea value={version.notes} onChange={v => update(index, "notes", v)} placeholder="Version notes" rows={2} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
