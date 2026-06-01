/**
 * PnLCalculator — Standalone P&L Calculator Page Shell
 *
 * Route: /pnl
 * Wraps the shared PnLCalculatorCore component.
 * Standalone calculator — no tender linkage (unless tenderId query param).
 */
import { Link } from "wouter";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PnLCalculatorCore from "@/components/pnl/PnLCalculatorCore";

export default function PnLCalculator() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <Link href="/workspaces">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Workspaces
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-serif font-bold">P&L Calculator</h1><p className="text-sm text-muted-foreground mt-0.5">Deal-level profitability model</p></div>
        <Button variant="outline" onClick={() => toast("PDF export coming soon")}><Download className="w-4 h-4 mr-1.5" />Export P&L</Button>
      </div>
      <PnLCalculatorCore />
    </div>
  );
}
