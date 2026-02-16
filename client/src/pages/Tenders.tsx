/*
 * Tender Management — 3-Phase Process with Committee Tracking
 * Swiss Precision Instrument Design
 * Maps to Tender Process Flow 2025 workflow
 */

import { useState } from "react";
import {
  Gavel,
  Plus,
  ChevronRight,
  Users,
  FileText,
  Calculator,
  ShieldCheck,
  Clock,
  Building2,
  Scale,
  DollarSign,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatSAR } from "@/lib/store";

interface TenderItem {
  id: string;
  title: string;
  client: string;
  industry: string;
  region: string;
  phase: "qualification" | "drafting" | "approval" | "submitted" | "won" | "lost";
  estimatedValue: number;
  deadline: string;
  submissionDate?: string;
  committee: string[];
  progress: number;
  tasks: { name: string; status: "done" | "in_progress" | "pending"; assignee: string }[];
  departments: { name: string; status: "complete" | "in_progress" | "pending" }[];
}

const mockTenders: TenderItem[] = [
  {
    id: "t1",
    title: "Ministry of Transport — National Warehousing RFP",
    client: "Ministry of Transport",
    industry: "Government",
    region: "Central",
    phase: "qualification",
    estimatedValue: 15000000,
    deadline: "2026-03-15",
    committee: ["Commercial Director", "Operation Director", "Sales Head", "Customer Support Head"],
    progress: 25,
    tasks: [
      { name: "SOW Qualification", status: "done", assignee: "Ra'ed" },
      { name: "Technical Review", status: "in_progress", assignee: "Yazan" },
      { name: "Technical Analysis", status: "pending", assignee: "Yazan" },
      { name: "Commercial Analysis", status: "pending", assignee: "Ra'ed" },
      { name: "Competition Analysis", status: "pending", assignee: "Albert" },
      { name: "Scope of Work", status: "pending", assignee: "Ra'ed" },
      { name: "P&L Costing", status: "pending", assignee: "Finance" },
    ],
    departments: [
      { name: "Commercial Team", status: "in_progress" },
      { name: "Operations", status: "pending" },
      { name: "Finance", status: "pending" },
      { name: "Legal", status: "pending" },
    ],
  },
  {
    id: "t2",
    title: "Saudi Aramco — Integrated Logistics Services Tender",
    client: "Saudi Aramco",
    industry: "Energy",
    region: "East",
    phase: "drafting",
    estimatedValue: 25000000,
    deadline: "2026-04-01",
    committee: ["Commercial Director", "Operation Director", "Sales Head"],
    progress: 55,
    tasks: [
      { name: "SOW Qualification", status: "done", assignee: "Ra'ed" },
      { name: "Technical Review", status: "done", assignee: "Yazan" },
      { name: "Technical Analysis", status: "done", assignee: "Yazan" },
      { name: "Commercial Analysis", status: "done", assignee: "Ra'ed" },
      { name: "Prepare Commercial Draft", status: "in_progress", assignee: "Ra'ed" },
      { name: "Prepare Technical Draft", status: "in_progress", assignee: "Yazan" },
      { name: "P&L Input & Pricing", status: "pending", assignee: "Finance" },
    ],
    departments: [
      { name: "Commercial Team", status: "in_progress" },
      { name: "Operations", status: "in_progress" },
      { name: "Finance", status: "in_progress" },
      { name: "Legal", status: "pending" },
    ],
  },
  {
    id: "t3",
    title: "NEOM — Cold Chain Logistics Partnership",
    client: "NEOM",
    industry: "Mega Projects",
    region: "West",
    phase: "approval",
    estimatedValue: 40000000,
    deadline: "2026-05-15",
    committee: ["Commercial Director", "Operation Director", "Sales Head", "Customer Support Head"],
    progress: 80,
    tasks: [
      { name: "SOW Qualification", status: "done", assignee: "Ra'ed" },
      { name: "Technical Review", status: "done", assignee: "Yazan" },
      { name: "Commercial & Technical Draft", status: "done", assignee: "Ra'ed" },
      { name: "P&L Input & Pricing", status: "done", assignee: "Finance" },
      { name: "Review P&L", status: "done", assignee: "Committee" },
      { name: "Adjustments to Technical", status: "done", assignee: "Yazan" },
      { name: "Commercial Director Approval", status: "in_progress", assignee: "Mohammed" },
    ],
    departments: [
      { name: "Commercial Team", status: "complete" },
      { name: "Operations", status: "complete" },
      { name: "Finance", status: "complete" },
      { name: "Legal", status: "in_progress" },
    ],
  },
];

const phaseConfig: Record<string, { label: string; color: string; step: number }> = {
  qualification: { label: "Phase 1: Qualification", color: "bg-blue-100 text-blue-800", step: 1 },
  drafting: { label: "Phase 2: Drafting", color: "bg-violet-100 text-violet-800", step: 2 },
  approval: { label: "Phase 3: Approval", color: "bg-amber-100 text-amber-800", step: 3 },
  submitted: { label: "Submitted", color: "bg-emerald-100 text-emerald-800", step: 4 },
  won: { label: "Won", color: "bg-green-100 text-green-800", step: 4 },
  lost: { label: "Lost", color: "bg-red-100 text-red-800", step: 4 },
};

const deptStatusColors: Record<string, string> = {
  complete: "text-emerald-600",
  in_progress: "text-amber-500",
  pending: "text-muted-foreground/40",
};

export default function Tenders() {
  const [selectedTender, setSelectedTender] = useState<string | null>(null);
  const tender = mockTenders.find(t => t.id === selectedTender);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Tender Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            3-phase tender process with committee tracking — {mockTenders.length} active tenders
          </p>
        </div>
        <Button onClick={() => toast("Tender creation coming soon")}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Tender
        </Button>
      </div>

      {/* Process Overview */}
      <Card className="border border-border shadow-none mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-serif">Tender Process Flow 2025</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-stretch gap-2">
            {[
              { phase: "Phase 1: Qualification & Analysis", items: ["SOW Qualification", "Technical Review", "Technical/Commercial/Competition Analysis", "Scope of Work", "P&L Costing"], depts: "Commercial + Ops + Finance + Legal" },
              { phase: "Phase 2: Drafting", items: ["Tender Committee convenes", "Prepare Commercial Draft", "Prepare Technical Draft", "P&L Input & Pricing", "Bank Guarantees"], depts: "Tender Committee + Finance" },
              { phase: "Phase 3: Review & Approval", items: ["Review P&L", "Adjust Technical/Commercial", "Commercial Director Approval", "Operations Director Sign-off"], depts: "Committee + Directors" },
            ].map((p, i) => (
              <div key={i} className="flex items-stretch flex-1">
                <div className="p-4 rounded-lg border border-border flex-1 bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-hala-navy)] text-white flex items-center justify-center text-xs font-bold">{i + 1}</div>
                    <span className="text-xs font-semibold">{p.phase}</span>
                  </div>
                  <ul className="space-y-1 mb-3">
                    {p.items.map(item => (
                      <li key={item} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{p.depts}</div>
                </div>
                {i < 2 && (
                  <div className="flex items-center px-1">
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tender List */}
        <div className={selectedTender ? "lg:col-span-1" : "lg:col-span-3"}>
          <div className="space-y-3">
            {mockTenders.map(t => {
              const config = phaseConfig[t.phase];
              const daysLeft = Math.ceil((new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <Card
                  key={t.id}
                  className={`border shadow-none hover:shadow-sm transition-all cursor-pointer ${selectedTender === t.id ? "border-primary ring-1 ring-primary/20" : "border-border"}`}
                  onClick={() => setSelectedTender(selectedTender === t.id ? null : t.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Gavel className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{t.title}</span>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${config.color}`}>
                        {config.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Est. Value</p>
                        <p className="text-sm font-bold font-mono">{formatSAR(t.estimatedValue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Deadline</p>
                        <p className="text-sm font-medium">{t.deadline}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Days Left</p>
                        <p className={`text-sm font-bold font-mono ${daysLeft <= 14 ? "text-[var(--color-rag-red)]" : daysLeft <= 30 ? "text-[var(--color-rag-amber)]" : ""}`}>
                          {daysLeft}d
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={t.progress} className="h-1.5 flex-1" />
                      <span className="text-[10px] font-mono text-muted-foreground">{t.progress}%</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Tender Detail */}
        {tender && (
          <div className="lg:col-span-2 space-y-4">
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-serif">{tender.title}</CardTitle>
                  <Badge variant="outline" className={`${phaseConfig[tender.phase].color}`}>
                    {phaseConfig[tender.phase].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { icon: Building2, label: "Client", value: tender.client },
                    { icon: DollarSign, label: "Est. Value", value: formatSAR(tender.estimatedValue) },
                    { icon: Clock, label: "Deadline", value: tender.deadline },
                    { icon: Scale, label: "Industry", value: tender.industry },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <item.icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                        <p className="text-sm font-medium">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="tasks">
              <TabsList>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="departments">Departments</TabsTrigger>
                <TabsTrigger value="committee">Committee</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks">
                <Card className="border border-border shadow-none">
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {tender.tasks.map((task, i) => (
                        <div key={i} className="flex items-center gap-3 p-3">
                          {task.status === "done" ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : task.status === "in_progress" ? (
                            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 shrink-0" />
                          )}
                          <span className={`text-sm flex-1 ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                            {task.name}
                          </span>
                          <span className="text-xs text-muted-foreground">{task.assignee}</span>
                          <Badge variant="outline" className={`text-[10px] ${task.status === "done" ? "border-emerald-300 text-emerald-700" : task.status === "in_progress" ? "border-amber-300 text-amber-700" : ""}`}>
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="departments">
                <Card className="border border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      {tender.departments.map(dept => (
                        <div key={dept.name} className="p-4 rounded-lg border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            {dept.status === "complete" ? (
                              <CheckCircle className={`w-4 h-4 ${deptStatusColors[dept.status]}`} />
                            ) : dept.status === "in_progress" ? (
                              <Clock className={`w-4 h-4 ${deptStatusColors[dept.status]}`} />
                            ) : (
                              <AlertTriangle className={`w-4 h-4 ${deptStatusColors[dept.status]}`} />
                            )}
                            <span className="text-sm font-medium">{dept.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {dept.status.replace("_", " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="committee">
                <Card className="border border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {tender.committee.map(member => (
                        <div key={member} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                          <div className="w-9 h-9 rounded-full bg-[var(--color-hala-navy)] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                            {member.split(" ").map(w => w[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{member}</p>
                            <p className="text-xs text-muted-foreground">Tender Committee Member</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
