import { Link } from "wouter";
/*
 * Handover Process — Sales & Commercial to Operations
 * Swiss Precision Instrument Design
 * Multi-department swimlane with MSA/SLA decision gate
 */

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
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
  ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatSAR } from "@/lib/store";

interface HandoverTask {
  task: string;
  status: "completed" | "in_progress" | "pending";
  assignee: string;
  dueDate: string;
}

interface HandoverDepartment {
  name: string;
  icon: string;
  tasks: HandoverTask[];
}

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
  departments: HandoverDepartment[];
}

const msaStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "MSA Pending", color: "bg-gray-100 text-gray-700" },
  negotiating: { label: "MSA Negotiating", color: "bg-amber-100 text-amber-800" },
  agreed: { label: "Terms Agreed", color: "bg-blue-100 text-blue-800" },
  signed: { label: "MSA Signed", color: "bg-emerald-100 text-emerald-800" },
};

const iconMap: Record<string, React.ElementType> = {
  Users,
  Scale,
  DollarSign,
  Settings
};

export default function Handover() {
  const [selectedHandover, setSelectedHandover] = useState<string | null>(null);
  const [handovers, setHandovers] = useState<HandoverProcess[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHandovers = async () => {
    try {
      const res = await api.handovers.list();
      setHandovers(res.data);
    } catch (e) {
      toast.error("Failed to fetch handovers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHandovers();
  }, []);

  const updateHandover = async (id: string, payload: Partial<HandoverProcess>) => {
    try {
      await api.handovers.update(id, payload);
      await fetchHandovers();
    } catch (e) {
      toast.error("Failed to update handover");
    }
  };

  // Default to first if none selected
  const activeHandoverId = selectedHandover || handovers[0]?.id;
  const handover = handovers.find((h: HandoverProcess) => h.id === activeHandoverId);

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground">Loading handovers...</div>;
  }

  if (!handovers.length || !handover) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-serif">No Handover Processes</h2>
        <p className="text-muted-foreground mt-2">There are no active handover processes to track.</p>
        <Button variant="outline" className="mt-4" onClick={() => toast("Handover initiation requires a workspace in 'Contract Signed' stage")}>
          <Plus className="w-4 h-4 mr-1.5" /> Initiate Handover
        </Button>
      </div>
    );
  }
  const totalTasks = handover.departments.reduce((sum: number, d: HandoverDepartment) => sum + d.tasks.length, 0);
  const completedTasks = handover.departments.reduce(
    (sum: number, d: HandoverDepartment) => sum + d.tasks.filter((t: HandoverTask) => t.status === "completed").length,
    0
  );
  const inProgressTasks = handover.departments.reduce(
    (sum: number, d: HandoverDepartment) => sum + d.tasks.filter((t: HandoverTask) => t.status === "in_progress").length,
    0
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="mb-4">
        <Link href="/workspaces">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Workspaces
          </Button>
        </Link>
      </div>
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
        {handovers.map((h: HandoverProcess) => (
          <Card
            key={h.id}
            className={`border shadow-none cursor-pointer shrink-0 w-72 hover:shadow-sm transition-all ${activeHandoverId === h.id ? "border-primary ring-1 ring-primary/20" : "border-border"}`}
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
          {handover.departments.map((dept: HandoverDepartment) => {
            const completed = dept.tasks.filter((t: HandoverTask) => t.status === "completed").length;
            const Icon = iconMap[dept.icon] || FileText;
            return (
              <TabsTrigger key={dept.name} value={dept.name} className="gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {dept.name}
                <Badge variant="secondary" className="text-[10px] ml-1">{completed}/{dept.tasks.length}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {handover.departments.map((dept: HandoverDepartment, deptIdx: number) => {
          const Icon = iconMap[dept.icon] || FileText;
          return (
          <TabsContent key={dept.name} value={dept.name}>
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-serif flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {dept.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {dept.tasks.map((task: HandoverTask, taskIdx: number) => (
                    <div 
                      key={taskIdx} 
                      className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => {
                        const newStatus = task.status === "completed" ? "pending" : (task.status === "pending" ? "in_progress" : "completed");
                        const newDepartments = [...handover.departments];
                        newDepartments[deptIdx].tasks[taskIdx].status = newStatus;
                        
                        updateHandover(handover.id, { departments: newDepartments });
                        toast.success(`Task status updated to ${newStatus}`);
                      }}
                    >
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
          );
        })}
      </Tabs>
    </div>
  );
}
