import { useState } from "react";
import { Shield, Users, Lock, AlertTriangle, CheckCircle, Settings, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { policyGates } from "@/lib/store";
import { toast } from "sonner";

const modeColors: Record<string, string> = { enforce: "bg-red-100 text-red-800", warn: "bg-amber-100 text-amber-800", off: "bg-gray-100 text-gray-600" };
const modeIcons: Record<string, React.ElementType> = { enforce: Lock, warn: AlertTriangle, off: Eye };

const roles = [
  { name: "CEO / CFO", level: 1, permissions: ["All system access", "Override all gates", "Approve <10% GP", "System configuration"], users: ["Mohammed Al-Harbi"] },
  { name: "Commercial Director", level: 2, permissions: ["Approve 10-22% GP", "Tender final approval", "Override warn gates", "Customer classification"], users: ["Ra'ed"] },
  { name: "Operations Director", level: 2, permissions: ["Tender sign-off", "Handover approval", "Capacity management", "SLA approval"], users: ["Yazan"] },
  { name: "Regional Sales Head", level: 3, permissions: ["Approve >22% GP", "Create workspaces", "Manage proposals", "CRM sync"], users: ["Albert", "Hano"] },
  { name: "Regional Operations Head", level: 3, permissions: ["Confirm space & ability", "Operational feasibility", "Handover tasks"], users: ["Ops East", "Ops Central", "Ops West"] },
  { name: "Salesman", level: 4, permissions: ["Create quotes", "Draft proposals", "View own workspaces", "CRM read"], users: ["Sales Team"] },
  { name: "Finance", level: 3, permissions: ["P&L review", "Insurance review", "Bank guarantees", "Billing setup"], users: ["Finance Team"] },
  { name: "Legal", level: 3, permissions: ["MSA review", "Contract review", "Document handover"], users: ["Legal Team"] },
];

export default function AdminGovernance() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Admin & Governance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Policy gates, role-based access, override doctrine</p>
        </div>
      </div>

      {/* Override Doctrine */}
      <Card className="border-2 border-[var(--color-hala-navy)]/20 shadow-none mb-6 bg-[var(--color-hala-navy)]/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Shield className="w-8 h-8 text-[var(--color-hala-navy)] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold mb-1">Override Doctrine — Truthpack Principle</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every policy gate operates in one of three modes: <strong>Enforce</strong> (blocks action, requires approval),
                <strong> Warn</strong> (allows action but logs override with reason), or <strong>Off</strong> (no check).
                Only the Commercial Director or CEO can change gate modes. All overrides are permanently logged.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="gates">
        <TabsList>
          <TabsTrigger value="gates">Policy Gates ({policyGates.length})</TabsTrigger>
          <TabsTrigger value="roles">Roles & Access ({roles.length})</TabsTrigger>
          <TabsTrigger value="matrix">Approval Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="gates" className="space-y-3">
          <div className="grid grid-cols-3 gap-3 mb-2">
            {(["enforce", "warn", "off"] as const).map(mode => {
              const Icon = modeIcons[mode];
              const count = policyGates.filter(g => g.mode === mode).length;
              return (
                <Card key={mode} className="border border-border shadow-none">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${modeColors[mode]}`}><Icon className="w-4 h-4" /></div>
                    <div><div className="text-lg font-bold font-mono">{count}</div><div className="text-[10px] text-muted-foreground capitalize">{mode}</div></div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {policyGates.map(gate => {
            const Icon = modeIcons[gate.mode] || Eye;
            return (
              <Card key={gate.id} className="border border-border shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${modeColors[gate.mode]}`}><Icon className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{gate.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${modeColors[gate.mode]}`}>{gate.mode}</Badge>
                        {gate.overridable && <Badge variant="secondary" className="text-[10px]">Overridable</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{gate.description}</p>
                    </div>
                    <Switch checked={gate.mode !== "off"} onCheckedChange={() => toast("Gate configuration requires admin privileges")} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="roles" className="space-y-3">
          {roles.map(role => (
            <Card key={role.name} className="border border-border shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-hala-navy)] text-white flex items-center justify-center text-sm font-bold shrink-0">L{role.level}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{role.name}</span>
                      <Badge variant="outline" className="text-[10px]">Level {role.level}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {role.permissions.map(p => <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{role.users.join(", ")}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="matrix" className="space-y-6">
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Pallet Volume Approval</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Volume</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Salesman</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Regional Sales Head</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Directors</th>
                </tr></thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="p-3 font-medium">&lt; 300 pallets</td>
                    <td className="p-3 text-center text-xs text-muted-foreground">Price List</td>
                    <td className="p-3 text-center"><CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" /></td>
                    <td className="p-3 text-center text-muted-foreground/30">—</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">&gt; 300 pallets</td>
                    <td className="p-3 text-center text-xs text-muted-foreground">Price List</td>
                    <td className="p-3 text-center"><CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" /></td>
                    <td className="p-3 text-center"><CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" /></td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-base font-serif">GP% Approval Matrix</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">GP%</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Salesman</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Regional Sales Head</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Regional Ops Head</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Directors: Opp & Com</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">CEO / CFO</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { gp: "> 30%", approvers: [true, true, "feasibility", false, false] },
                      { gp: "> 25%", approvers: [true, true, "feasibility", false, false] },
                      { gp: "> 22%", approvers: [true, true, true, false, false] },
                      { gp: "10 – 22%", approvers: [true, true, true, true, false] },
                      { gp: "< 10%", approvers: [true, true, true, true, true] },
                    ].map((row, i) => (
                      <tr key={i} className={`border-b border-border ${i >= 3 ? "bg-red-50/30" : ""}`}>
                        <td className="p-3 font-medium font-mono">{row.gp}</td>
                        {row.approvers.map((a, j) => (
                          <td key={j} className="p-3 text-center">
                            {a === true ? <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" /> :
                             a === "feasibility" ? <div className="text-center"><CheckCircle className="w-4 h-4 text-blue-500 mx-auto" /><span className="text-[9px] text-blue-600 block mt-0.5">Space & Ability</span></div> :
                             <span className="text-muted-foreground/30">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs text-amber-800"><strong>Note:</strong> Director approval must be obtained <strong>in writing</strong>. All approvals are logged in the audit trail.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
