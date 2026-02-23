import { useState } from "react";
import { Link } from "wouter";
import { Search, ChevronRight, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatSAR } from "@/lib/store";
import { useCustomers } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const gradeColors: Record<string, string> = { A: "bg-emerald-100 text-emerald-800", B: "bg-blue-100 text-blue-800", C: "bg-amber-100 text-amber-800", D: "bg-orange-100 text-orange-800", F: "bg-red-100 text-red-800", TBA: "bg-gray-100 text-gray-600" };

export default function Customers() {
  const { data: customers, loading } = useCustomers();
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  const filtered = customers.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.code.toLowerCase().includes(search.toLowerCase())) return false;
    if (gradeFilter !== "all" && c.grade !== gradeFilter) return false;
    if (regionFilter !== "all" && c.region !== regionFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-serif font-bold">Customer Portfolio</h1><p className="text-sm text-muted-foreground mt-0.5">{customers.length} customers — {customers.filter(c => c.status === "Active").length} active</p></div>
        <Button variant="outline" onClick={() => toast("Export feature coming soon")}><Download className="w-4 h-4 mr-1.5" />Export</Button>
      </div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="text" placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-4 py-1.5 text-sm bg-muted rounded-md border-0 w-56 focus:outline-none focus:ring-1 focus:ring-ring" /></div>
        <Select value={gradeFilter} onValueChange={setGradeFilter}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent><SelectItem value="all">All Grades</SelectItem>{["A","B","C","D","F"].map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent></Select>
        <Select value={regionFilter} onValueChange={setRegionFilter}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Region" /></SelectTrigger><SelectContent><SelectItem value="all">All Regions</SelectItem>{["East","Central","West"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{["Active","Closed","Terminated","Inactive"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <Card className="border border-border shadow-none"><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-border">
        {["Code","Customer","Grade","Region","Industry","Service","Status","Contract Value","DSO","Pallets",""].map(h => <th key={h} className={`text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3 ${["Contract Value","DSO","Pallets"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>)}
      </tr></thead><tbody>
        {filtered.map(c => (
          <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
            <td className="px-3 py-2.5"><span className="data-value text-xs text-muted-foreground">{c.code}</span></td>
            <td className="px-3 py-2.5"><Link href={`/customers/${c.id}`}><span className="text-sm font-medium hover:text-primary">{c.name}</span></Link></td>
            <td className="px-3 py-2.5"><Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${gradeColors[c.grade] || ""}`}>{c.grade}</Badge></td>
            <td className="px-3 py-2.5 text-sm text-muted-foreground">{c.region}</td>
            <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.industry}</td>
            <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px]">{c.serviceType}</Badge></td>
            <td className="px-3 py-2.5"><span className={`text-xs font-medium ${c.status === "Active" ? "rag-green" : c.status === "Terminated" ? "rag-red" : "text-muted-foreground"}`}>{c.status}</span></td>
            <td className="px-3 py-2.5 text-right"><span className="data-value text-sm">{formatSAR(c.contractValue2025)}</span></td>
            <td className="px-3 py-2.5 text-right"><span className={`data-value text-sm ${c.dso > 60 ? "rag-red" : c.dso > 45 ? "rag-amber" : "text-muted-foreground"}`}>{c.dso}</span></td>
            <td className="px-3 py-2.5 text-right"><span className="data-value text-sm text-muted-foreground">{c.palletContracted.toLocaleString()}</span></td>
            <td className="px-3 py-2.5"><Link href={`/customers/${c.id}`}><ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" /></Link></td>
          </tr>
        ))}
      </tbody></table></div>
      {filtered.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No customers match filters</div>}
      </CardContent></Card>
    </div>
  );
}
