/*
 * Admin Panel — System Configuration, User Management, Integration Settings
 * Navigation Simplification v1: Now also serves as the gateway to
 *   Document System (Templates, Variables, Block Library, Block Builder, Branding)
 *   Automation (Bot Governance, Signal Engine, Bot Audit)
 *   ECR (ECR Dashboard, ECR Config)
 */
import { useState } from "react";
import { Link } from "wouter";
import {
  Users, Settings, Database, Link2, Bell, Shield, Key, Globe,
  Plus, Edit3, Trash2, Check, RefreshCw, Server, HardDrive,
  Mail, Building2, UserPlus, Search, ChevronRight,
  Layers, Wrench, Star, Bot, Radio, Activity, BarChart3,
  FileText, Palette, BookOpen, Blocks, Variable,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { users } from "@/lib/store";
import { navigationV1 } from "@/components/DashboardLayout";
import { toast } from "sonner";

const systemModules = [
  { name: "CRM Sync Engine", status: "active", lastSync: "2 min ago", icon: RefreshCw, color: "text-emerald-600 bg-emerald-50" },
  { name: "PDF Compiler", status: "active", lastSync: "Ready", icon: HardDrive, color: "text-blue-600 bg-blue-50" },
  { name: "Approval Engine", status: "active", lastSync: "Running", icon: Shield, color: "text-violet-600 bg-violet-50" },
  { name: "Audit Logger", status: "active", lastSync: "Recording", icon: Database, color: "text-amber-600 bg-amber-50" },
  { name: "AI Authoring", status: "active", lastSync: "Available", icon: Server, color: "text-pink-600 bg-pink-50" },
  { name: "Notification Service", status: "inactive", lastSync: "Disabled", icon: Bell, color: "text-gray-400 bg-gray-50" },
];

const integrations = [
  { name: "Zoho CRM", status: "mock", description: "Deal sync, contact sync, stage updates", apiKey: "Not configured", icon: Link2 },
  { name: "Zoho Books", status: "planned", description: "Invoice generation, payment tracking", apiKey: "Not configured", icon: Building2 },
  { name: "WMS (Blue Yonder)", status: "planned", description: "Inventory data, space utilization", apiKey: "Not configured", icon: Database },
  { name: "Email (SMTP)", status: "planned", description: "Notification emails, document sharing", apiKey: "Not configured", icon: Mail },
  { name: "Supabase", status: "planned", description: "Cloud database migration target", apiKey: "Not configured", icon: Globe },
];

/* ─── Document System links ─── */
const docSystemLinks = [
  { path: "/template-manager", label: "Templates", desc: "Manage document templates for quotes, proposals, and SLAs", icon: Layers, count: "12 templates" },
  { path: "/variables", label: "Variables", desc: "Define and manage custom variables used in document tokens", icon: Variable, count: "48 variables" },
  { path: "/block-library", label: "Block Library", desc: "Reusable content blocks shared across templates", icon: BookOpen, count: "24 blocks" },
  { path: "/block-builder", label: "Block Builder", desc: "Visual block editor for creating new content blocks", icon: Blocks, count: "Builder" },
  { path: "/branding-profiles", label: "Branding", desc: "Brand profiles controlling colors, fonts, and logos on documents", icon: Palette, count: "3 profiles" },
];

/* ─── Automation links ─── */
const automationLinks = [
  { path: "/bot-registry", label: "Bot Governance", desc: "Manage AI bots, permissions, and authority boundaries", icon: Bot, count: "5 bots" },
  { path: "/signal-engine", label: "Signal Engine", desc: "Configure automated signals, alerts, and escalation triggers", icon: Radio, count: "12 signals" },
  { path: "/bot-audit", label: "Bot Audit", desc: "Review all bot actions, decisions, and override attempts", icon: Activity, count: "Audit log" },
];

/* ─── ECR links ─── */
const ecrLinks = [
  { path: "/ecr", label: "ECR Dashboard", desc: "Customer rating overview with risk scores and trends", icon: BarChart3, count: "11 customers" },
  { path: "/ecr-rule-sets", label: "Rule Sets", desc: "Configure scoring rules for customer evaluation", icon: Layers, count: "4 rule sets" },
  { path: "/ecr-scoring", label: "Scoring", desc: "View and manage individual customer scores", icon: Star, count: "Scores" },
  { path: "/ecr-connectors", label: "Connectors", desc: "Data source connectors for external rating inputs", icon: Link2, count: "3 connectors" },
  { path: "/ecr-metrics", label: "Metrics", desc: "ECR performance metrics and analytics", icon: Database, count: "Metrics" },
];

function AdminLinkCard({ item }: { item: { path: string; label: string; desc: string; icon: React.ElementType; count: string } }) {
  const Icon = item.icon;
  return (
    <Link href={item.path}>
      <Card className="border border-border shadow-none hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{item.count}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-sm font-semibold mb-0.5 group-hover:text-primary transition-colors">{item.label}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function AdminPanel() {
  const [userSearch, setUserSearch] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("salesman");

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-800",
    commercial_director: "bg-violet-100 text-violet-800",
    operations_director: "bg-blue-100 text-blue-800",
    regional_sales_head: "bg-emerald-100 text-emerald-800",
    regional_ops_head: "bg-teal-100 text-teal-800",
    salesman: "bg-gray-100 text-gray-700",
    finance: "bg-amber-100 text-amber-800",
    legal: "bg-indigo-100 text-indigo-800",
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">System configuration, user management, and integrations</p>
        </div>
      </div>

      <Tabs defaultValue={navigationV1 ? "doc-system" : "users"}>
        <TabsList className="flex-wrap h-auto gap-1">
          {navigationV1 && (
            <>
              <TabsTrigger value="doc-system"><FileText className="w-3.5 h-3.5 mr-1.5" />Document System</TabsTrigger>
              <TabsTrigger value="automation"><Bot className="w-3.5 h-3.5 mr-1.5" />Automation</TabsTrigger>
              <TabsTrigger value="ecr"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />ECR</TabsTrigger>
            </>
          )}
          <TabsTrigger value="users"><Users className="w-3.5 h-3.5 mr-1.5" />Users ({users.length})</TabsTrigger>
          <TabsTrigger value="system"><Server className="w-3.5 h-3.5 mr-1.5" />System Modules</TabsTrigger>
          <TabsTrigger value="integrations"><Link2 className="w-3.5 h-3.5 mr-1.5" />Integrations</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-3.5 h-3.5 mr-1.5" />Settings</TabsTrigger>
        </TabsList>

        {/* ─── Document System Tab (navigationV1 only) ─── */}
        {navigationV1 && (
          <TabsContent value="doc-system" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif font-semibold">Document System</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Templates, variables, blocks, and branding profiles used by the Document Composer</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {docSystemLinks.map(item => (
                <AdminLinkCard key={item.path} item={item} />
              ))}
            </div>
          </TabsContent>
        )}

        {/* ─── Automation Tab (navigationV1 only) ─── */}
        {navigationV1 && (
          <TabsContent value="automation" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif font-semibold">Automation</h2>
                <p className="text-xs text-muted-foreground mt-0.5">AI bots, signal engine, and automated governance</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {automationLinks.map(item => (
                <AdminLinkCard key={item.path} item={item} />
              ))}
            </div>
          </TabsContent>
        )}

        {/* ─── ECR Tab (navigationV1 only) ─── */}
        {navigationV1 && (
          <TabsContent value="ecr" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif font-semibold">ECR — Enterprise Customer Rating</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Customer scoring, rule sets, and data connectors</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {ecrLinks.map(item => (
                <AdminLinkCard key={item.path} item={item} />
              ))}
            </div>
          </TabsContent>
        )}

        {/* ─── Users Tab ─── */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button size="sm" onClick={() => setShowAddUser(!showAddUser)}>
              <UserPlus className="w-4 h-4 mr-1.5" /> Add User
            </Button>
          </div>

          {showAddUser && (
            <Card className="border-2 border-primary/20 shadow-none">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Add New User</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Full Name</Label>
                    <Input placeholder="e.g., Ahmed Al-Rashidi" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input placeholder="e.g., ahmed@halascs.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Role</Label>
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin (CEO/CFO)</SelectItem>
                        <SelectItem value="commercial_director">Commercial Director</SelectItem>
                        <SelectItem value="operations_director">Operations Director</SelectItem>
                        <SelectItem value="regional_sales_head">Regional Sales Head</SelectItem>
                        <SelectItem value="regional_ops_head">Regional Ops Head</SelectItem>
                        <SelectItem value="salesman">Salesman</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="legal">Legal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => setShowAddUser(false)}>Cancel</Button>
                  <Button size="sm" onClick={() => {
                    if (!newUserName.trim() || !newUserEmail.trim()) {
                      toast.error("Name and email are required");
                      return;
                    }
                    toast.success("User added", { description: `${newUserName} — ${newUserRole.replace(/_/g, " ")}` });
                    setShowAddUser(false);
                    setNewUserName("");
                    setNewUserEmail("");
                    setNewUserRole("salesman");
                  }}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Add User
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border border-border shadow-none">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">User</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Role</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Region</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-hala-navy)] text-white flex items-center justify-center text-xs font-bold">
                            {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${roleColors[user.role] || ""}`}>
                          {user.role.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{user.region || "All"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">Active</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toast("Edit user coming soon")}>
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => toast("User deactivation requires admin confirmation")}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── System Modules Tab ─── */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {systemModules.map(mod => {
              const Icon = mod.icon;
              return (
                <Card key={mod.name} className="border border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mod.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${mod.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-500"}`}>
                        {mod.status}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-semibold mb-0.5">{mod.name}</h3>
                    <p className="text-xs text-muted-foreground">{mod.lastSync}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Switch checked={mod.status === "active"} onCheckedChange={() => toast(`${mod.name} toggle requires system restart`)} />
                      <span className="text-[10px] text-muted-foreground">{mod.status === "active" ? "Enabled" : "Disabled"}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Integrations Tab ─── */}
        <TabsContent value="integrations" className="space-y-3">
          {integrations.map(int => {
            const Icon = int.icon;
            return (
              <Card key={int.name} className="border border-border shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold">{int.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${
                          int.status === "mock" ? "bg-amber-50 text-amber-700" :
                          int.status === "active" ? "bg-emerald-50 text-emerald-700" :
                          "bg-gray-50 text-gray-500"
                        }`}>
                          {int.status === "mock" ? "Mock Mode" : int.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{int.description}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Key className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-mono">{int.apiKey}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => toast(`Configure ${int.name} API credentials`)}>
                        <Settings className="w-3.5 h-3.5 mr-1" /> Configure
                      </Button>
                      {int.status === "mock" && (
                        <Button size="sm" className="text-xs h-8" onClick={() => toast("Provide Zoho API credentials to activate live sync")}>
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-2 border-dashed border-border shadow-none">
            <CardContent className="p-6 text-center">
              <Plus className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Add Custom Integration</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Connect any REST API with custom credentials</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => toast("Custom integration setup coming soon")}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Integration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Settings Tab ─── */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-base font-serif">General Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Organization Name</Label>
                  <Input defaultValue="Hala Supply Chain Solutions" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Currency</Label>
                  <Select defaultValue="SAR">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAR">SAR — Saudi Riyal</SelectItem>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                      <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Region</Label>
                  <Select defaultValue="East">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="East">Eastern Province</SelectItem>
                      <SelectItem value="Central">Central Province</SelectItem>
                      <SelectItem value="West">Western Province</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Fiscal Year Start</Label>
                  <Select defaultValue="jan">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jan">January</SelectItem>
                      <SelectItem value="apr">April</SelectItem>
                      <SelectItem value="jul">July</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Feature Flags</h4>
                <div className="flex items-center justify-between">
                  <div><span className="text-sm">AI Authoring</span><p className="text-xs text-muted-foreground">Enable AI draft generation in the Commercial Editor</p></div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div><span className="text-sm">Auto CRM Sync</span><p className="text-xs text-muted-foreground">Automatically sync deals from Zoho CRM every 5 minutes</p></div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div><span className="text-sm">Email Notifications</span><p className="text-xs text-muted-foreground">Send email alerts for approvals and escalations</p></div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div><span className="text-sm">Audit Trail Export</span><p className="text-xs text-muted-foreground">Allow exporting audit trail as CSV/PDF</p></div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div><span className="text-sm">Navigation v1</span><p className="text-xs text-muted-foreground">Simplified sidebar — Workspace-centric navigation (currently {navigationV1 ? "ON" : "OFF"})</p></div>
                  <Switch checked={navigationV1} onCheckedChange={() => toast("Feature flag change requires code deployment")} />
                </div>
                <div className="flex items-center justify-between">
                  <div><span className="text-sm">Dark Mode</span><p className="text-xs text-muted-foreground">Enable dark theme option for users</p></div>
                  <Switch />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Document Branding</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Company Logo URL</Label>
                    <Input defaultValue="https://halascs.com/logo.png" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">PDF Footer Text</Label>
                    <Input defaultValue="Hala Supply Chain Solutions — Confidential" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Primary Brand Color</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-[#1B2A4A] border border-border" />
                      <Input defaultValue="#1B2A4A" className="font-mono text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-[#2563EB] border border-border" />
                      <Input defaultValue="#2563EB" className="font-mono text-xs" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline">Reset to Defaults</Button>
            <Button onClick={() => toast.success("Settings saved")}>Save Settings</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
