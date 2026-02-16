/*
 * Handover Process — Sales & Commercial to Operations
 * Swiss Precision Instrument Design
 * Multi-department swimlane with MSA/SLA decision gate
 */

import { useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle,
  Circle,
  Clock,
  ChevronRight,
  Users,
  Scale,
  DollarSign,
  Settings,
  FileText,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatSAR } from "@/lib/store";

interface HandoverProcess {
  id: string;
  customer: string;
  workspace: string;
  crmDealId: string;
  contractValue: number;
  startDate: string;
  targetGoLive: string;
  overallProgress: number;
  msaStatus: "pending" | "negotiating" | "agreed" | "signed";
  departments: {
    name: string;
    icon: React.ElementType;
    tasks: { task: string; status: "completed" | "in_progress" | "pending"; assignee: string; dueDate: string }[];
  }[];
}

const mockHandovers: HandoverProcess[] = [
  {
    id: "h1",
    customer: "Aramco Services",
    workspace: "Aramco Dhahran VAS Expansion",
    crmDealId: "ZH-4410",
    contractValue: 12000000,
    startDate: "2026-02-08",
    targetGoLive: "2026-04-01",
    overallProgress: 35,
    msaStatus: "negotiating",
    departments: [
      {
        name: "Sales / Commercial",
        icon: Users,
        tasks: [
          { task: "Client agrees on Hala SCS Proposal", status: "completed", assignee: "Ra'ed", dueDate: "2026-02-08" },
          { task: "Request CA, Communication Matrix & Legal docs", status: "completed", assignee: "Ra'ed", dueDate: "2026-02-10" },
          { task: "Draft MSA & SO/SLA with Ops agreement", status: "in_progress", assignee: "Ra'ed", dueDate: "2026-02-18" },
          { task: "Issue MSA & SO/SLA to Client, Cc. Sales", status: "pending", assignee: "Ra'ed", dueDate: "2026-02-22" },
          { task: "Close & Update CRM with reason", status: "pending", assignee: "Ra'ed", dueDate: "2026-02-25" },
          { task: "Brief Ops on new client", status: "pending", assignee: "Ra'ed", dueDate: "2026-03-01" },
          { task: "Send introduction email to client + ops", status: "pending", assignee: "Ra'ed", dueDate: "2026-03-03" },
          { task: "Advise Finance on agreed invoicing process", status: "pending", assignee: "Ra'ed", dueDate: "2026-03-05" },
          { task: "Request client training on vendor portal", status: "pending", assignee: "Ra'ed", dueDate: "2026-03-10" },
        ],
      },
      {
        name: "Legal Department",
        icon: Scale,
        tasks: [
          { task: "MSA negotiation", status: "in_progress", assignee: "Legal Team", dueDate: "2026-02-20" },
          { task: "Handover original documents", status: "pending", assignee: "Legal Team", dueDate: "2026-03-01" },
          { task: "Review contracts", status: "pending", assignee: "Legal Focal Point", dueDate: "2026-03-05" },
        ],
      },
      {
        name: "Finance Department",
        icon: DollarSign,
        tasks: [
          { task: "Review Insurance", status: "pending", assignee: "Finance", dueDate: "2026-02-25" },
          { task: "Review P&L", status: "pending", assignee: "Finance", dueDate: "2026-02-28" },
          { task: "Requirements / Cost analysis", status: "pending", assignee: "Finance", dueDate: "2026-03-01" },
          { task: "Process Bank Guarantees", status: "pending", assignee: "Finance", dueDate: "2026-03-05" },
          { task: "Share standard invoice & billing report", status: "pending", assignee: "Finance", dueDate: "2026-03-10" },
          { task: "Training on billing with client", status: "pending", assignee: "Finance", dueDate: "2026-03-15" },
        ],
      },
      {
        name: "Operations Department",
        icon: Settings,
        tasks: [
          { task: "Schedule kick-off meeting / starting date", status: "pending", assignee: "Ops Manager", dueDate: "2026-03-01" },
          { task: "Brief Ops on new client requirements", status: "pending", assignee: "Ops Manager", dueDate: "2026-03-05" },
          { task: "Upload MSA, SO/SLA & Legal docs in WMS/FS", status: "pending", assignee: "Ops Manager", dueDate: "2026-03-10" },
          { task: "Client portal setup and training", status: "pending", assignee: "IT/Ops", dueDate: "2026-03-15" },
        ],
      },
    ],
  },
  {
    id: "h2",
    customer: "Nestlé KSA",
    workspace: "Nestlé Jeddah Cold Chain",
    crmDealId: "ZH-4450",
    contractValue: 6200000,
    startDate: "2026-02-11",
    targetGoLive: "2026-05-01",
    overallProgress: 15,
    msaStatus: "pending",
    departments: [
      {
        name: "Sales / Commercial",
        icon: Users,
        tasks: [
          { task: "Client agrees on Hala SCS Proposal", status: "completed", assignee: "Hano", dueDate: "2026-02-11" },
          { task: "Request CA, Communication Matrix & Legal docs", status: "in_progress", assignee: "Hano", dueDate: "2026-02-18" },
          { task: "Draft MSA & SO/SLA with Ops agreement", status: "pending", assignee: "Hano", dueDate: "2026-02-25" },
          { task: "Issue MSA & SO/SLA to Client", status: "pending", assignee: "Hano", dueDate: "2026-03-01" },
        ],
      },
      {
        name: "Legal Department",
        icon: Scale,
        tasks: [
          { task: "MSA negotiation", status: "pending", assignee: "Legal Team", dueDate: "2026-03-05" },
          { task: "Handover original documents", status: "pending", assignee: "Legal Team", dueDate: "2026-03-15" },
        ],
      },
      {
        name: "Finance Department",
        icon: DollarSign,
        tasks: [
          { task: "Review Insurance", status: "pending", assignee: "Finance", dueDate: "2026-03-10" },
          { task: "Review P&L", status: "pending", assignee: "Finance", dueDate: "2026-03-15" },
          { task: "Process Bank Guarantees", status: "pending", assignee: "Finance", dueDate: "2026-03-20" },
        ],
      },
      {
        name: "Operations Department",
        icon: Settings,
        tasks: [
          { task: "Schedule kick-off meeting", status: "pending", assignee: "Ops Manager", dueDate: "2026-04-01" },
          { task: "Cold chain facility preparation", status: "pending", assignee: "Ops Manager", dueDate: "2026-04-15" },
        ],
      },
    ],
  },
];

const msaStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "MSA Pending", color: "bg-gray-100 text-gray-700" },
  negotiating: { label: "MSA Negotiating", color: "bg-amber-100 text-amber-800" },
  agreed: { label: "Terms Agreed", color: "bg-blue-100 text-blue-800" },
  signed: { label: "MSA Signed", color: "bg-emerald-100 text-emerald-800" },
};

export default function Handover() {
  const [selectedHandover, setSelectedHandover] = useState<string>(mockHandovers[0].id);
  const handover = mockHandovers.find(h => h.id === selectedHandover)!;

  const totalTasks = handover.departments.reduce((sum, d) => sum + d.tasks.length, 0);
  const completedTasks = handover.departments.reduce(
    (sum, d) => sum + d.tasks.filter(t => t.status === "completed").length,
    0
  );
  const inProgressTasks = handover.departments.reduce(
    (sum, d) => sum + d.tasks.filter(t => t.status === "in_progress").length,
    0
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Handover Process</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sales & Commercial to Operations — multi-department handover checklist
          </p>
        </div>
        <Button variant="outline" onClick={() => toast("Handover initiation requires a workspace in 'Contract Signed' stage")}>
          <Plus className="w-4 h-4 mr-1.5" />
          Initiate Handover
        </Button>
      </div>

      {/* Handover Selector */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
        {mockHandovers.map(h => (
          <Card
            key={h.id}
            className={`border shadow-none cursor-pointer shrink-0 w-72 hover:shadow-sm transition-all ${selectedHandover === h.id ? "border-primary ring-1 ring-primary/20" : "border-border"}`}
            onClick={() => setSelectedHandover(h.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate">{h.customer}</span>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${msaStatusConfig[h.msaStatus].color}`}>
                  {msaStatusConfig[h.msaStatus].label}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={h.overallProgress} className="h-1.5 flex-1" />
                <span className="text-[10px] font-mono text-muted-foreground">{h.overallProgress}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Handover Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Contract Value", value: formatSAR(handover.contractValue), icon: DollarSign },
          { label: "Total Tasks", value: `${completedTasks}/${totalTasks} complete`, icon: CheckCircle },
          { label: "In Progress", value: `${inProgressTasks} tasks`, icon: Clock },
          { label: "Target Go-Live", value: handover.targetGoLive, icon: ArrowRightLeft },
        ].map(stat => (
          <Card key={stat.label} className="border border-border shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <stat.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">{stat.label}</p>
                <p className="text-sm font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MSA Decision Gate */}
      <Card className="border-2 border-amber-200 shadow-none mb-6 bg-amber-50/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-700" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">MSA Decision Gate</span>
                <Badge variant="outline" className={`text-[10px] ${msaStatusConfig[handover.msaStatus].color}`}>
                  {msaStatusConfig[handover.msaStatus].label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {handover.msaStatus === "pending" && "MSA & SO/SLA drafting has not started. Sales must initiate with Legal and Ops."}
                {handover.msaStatus === "negotiating" && "MSA is under negotiation between Hala and client. If terms are not agreed, CRM will be updated with rejection reason."}
                {handover.msaStatus === "agreed" && "Terms agreed by both parties. MSA ready for signing. Share copies with Finance, Sales & Ops."}
                {handover.msaStatus === "signed" && "MSA signed. Upload to WMS/FS. Proceed with full handover."}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {handover.msaStatus !== "signed" && (
                <Button size="sm" variant="outline" onClick={() => toast("MSA status update requires Legal department action")}>
                  Update Status
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department Swimlanes */}
      <Tabs defaultValue={handover.departments[0].name}>
        <TabsList>
          {handover.departments.map(dept => {
            const completed = dept.tasks.filter(t => t.status === "completed").length;
            return (
              <TabsTrigger key={dept.name} value={dept.name} className="gap-1.5">
                <dept.icon className="w-3.5 h-3.5" />
                {dept.name}
                <Badge variant="secondary" className="text-[10px] ml-1">{completed}/{dept.tasks.length}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {handover.departments.map(dept => (
          <TabsContent key={dept.name} value={dept.name}>
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-serif flex items-center gap-2">
                  <dept.icon className="w-4 h-4" />
                  {dept.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {dept.tasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
                      {task.status === "completed" ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : task.status === "in_progress" ? (
                        <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground/30 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : "font-medium"}`}>
                          {task.task}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{task.assignee}</span>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">{task.dueDate}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          task.status === "completed"
                            ? "border-emerald-300 text-emerald-700"
                            : task.status === "in_progress"
                            ? "border-amber-300 text-amber-700"
                            : ""
                        }`}
                      >
                        {task.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
