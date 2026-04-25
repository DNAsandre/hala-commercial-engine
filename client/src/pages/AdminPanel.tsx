/*
 * Admin Panel — System Configuration, User Management, Integration Settings
 * Navigation Simplification v1: Now also serves as the gateway to
 *   Document System (Templates, Variables, Block Library, Block Builder, Branding)
 *   Automation (Bot Governance, Signal Engine, Bot Audit)
 *   ECR (ECR Dashboard, ECR Config)
 */
import { useState, useCallback, useEffect } from "react";
import { Link } from "wouter";
import {
  Users, Settings, Database, Link2, Bell, Shield, Key, Globe,
  Plus, Edit3, Trash2, Check, RefreshCw, Server, HardDrive,
  Mail, Building2, UserPlus, Search, ChevronRight, X,
  Layers, Wrench, Star, Bot, Radio, Activity, BarChart3,
  FileText, Palette, BookOpen, Blocks, Variable, Eye, EyeOff,
  RotateCcw, Lock, UserCheck, UserX, Brain, Zap,
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
import { useUsers } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
import { navigationV1 } from "@/components/DashboardLayout";
import { fetchCollections, type KBCollection } from "@/lib/knowledgebase";
import { fetchConnections, getSyncHealthStats, type CRMConnection } from "@/lib/crm-sync-engine";
import { toast } from "sonner";
import {
  adminCreateUser,
  adminUpdateUser,
  adminResetPassword,
  adminDeactivateUser,
  adminReactivateUser,
} from "@/lib/admin-api";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAIProviders,
  updateAIProvider,
  testProviderConnection,
  type AIProvider,
  type AIProviderName,
} from "@/lib/ai-client";

/* ─── AI Providers Embed (inline in Admin tab) ─── */
function CRMSyncEmbed() {
  const [crmConns, setCrmConns] = useState<CRMConnection[]>([]);
  const [crmLoading, setCrmLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchConnections().then((c) => { if (!cancelled) { setCrmConns(c); setCrmLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  if (crmLoading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const stats = getSyncHealthStats();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-[#1B2A4A]">{crmConns.length}</div><div className="text-xs text-muted-foreground">Connections</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-emerald-600">{stats.success}</div><div className="text-xs text-muted-foreground">Synced</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-red-600">{stats.failed}</div><div className="text-xs text-muted-foreground">Failed</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-amber-600">{stats.retrying}</div><div className="text-xs text-muted-foreground">Retrying</div></CardContent></Card>
      </div>
      <div className="space-y-2">
        {crmConns.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{c.provider === "zoho" ? "\ud83d\udfe0" : "\ud83d\udfe2"}</span>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.base_url}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.health_status === "connected" ? "default" : c.health_status === "configuring" ? "outline" : "destructive"} className="text-xs">
                  {c.health_status}
                </Badge>
                <Badge variant={c.enabled ? "default" : "secondary"} className="text-xs">{c.enabled ? "Active" : "Disabled"}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function KnowledgebaseEmbed() {
  const [collections, setKBCollections] = useState<KBCollection[]>([]);
  const [kbLoading, setKBLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCollections().then((c) => { if (!cancelled) { setKBCollections(c); setKBLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  if (kbLoading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[#1B2A4A]">{collections.length}</div>
            <div className="text-xs text-muted-foreground">Collections</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{collections.reduce((s, c) => s + (c.doc_count || 0), 0)}</div>
            <div className="text-xs text-muted-foreground">Documents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{collections.reduce((s, c) => s + (c.chunk_count || 0), 0)}</div>
            <div className="text-xs text-muted-foreground">Total Chunks</div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-2">
        {collections.map(col => (
          <Card key={col.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{col.name}</div>
                <div className="text-[10px] text-muted-foreground">{col.doc_count || 0} docs · {col.chunk_count || 0} chunks · {col.visibility}</div>
              </div>
              <Badge variant={col.visibility === "admin-only" ? "destructive" : "secondary"} className="text-[10px]">{col.visibility}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Use the full page to create collections, upload documents, and manage chunks for AI bot context retrieval.</p>
    </div>
  );
}

function AIProvidersEmbed() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAIProviders(true).then((p) => { if (!cancelled) { setProviders(p); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    setProviders((ps) => ps.map((p) => (p.id === id ? { ...p, enabled } : p)));
    const result = await updateAIProvider(id, { enabled });
    if (!result) {
      fetchAIProviders(true).then(setProviders);
      toast.error("Failed to update provider");
      return;
    }
    toast.success(`Provider ${enabled ? "enabled" : "disabled"}`);
  };

  const handleModelChange = async (id: string, model: string) => {
    setProviders((ps) => ps.map((p) => (p.id === id ? { ...p, modelDefault: model } : p)));
    const result = await updateAIProvider(id, { modelDefault: model });
    if (!result) {
      fetchAIProviders(true).then(setProviders);
      toast.error("Failed to update model");
    }
  };

  const handleTest = async (name: AIProviderName, id: string) => {
    setTestingId(id);
    try {
      const result = await testProviderConnection(name);
      if (result.success) {
        toast.success(`Connection OK (${result.latencyMs}ms)`);
      } else {
        toast.error(result.error || "Connection failed");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTestingId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {providers.map((p) => {
        const colors = p.name === "openai"
          ? { gradient: "from-emerald-500 to-teal-600", icon: "\uD83E\uDD16", border: p.enabled ? "border-emerald-300" : "border-border" }
          : { gradient: "from-blue-500 to-indigo-600", icon: "\u2726", border: p.enabled ? "border-blue-300" : "border-border" };
        return (
          <Card key={p.id} className={`border ${colors.border} transition-all ${!p.enabled ? "opacity-70" : ""}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white text-lg`}>
                    {colors.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{p.displayName}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{p.modelDefault}</div>
                  </div>
                </div>
                <Switch checked={p.enabled} onCheckedChange={(v) => handleToggle(p.id, v)} />
              </div>
              <div className="flex items-center gap-2">
                <Select value={p.modelDefault} onValueChange={(v) => handleModelChange(p.id, v)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {p.models.map((m) => <SelectItem key={m} value={m}><span className="font-mono text-xs">{m}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  disabled={!p.enabled || testingId === p.id}
                  onClick={() => handleTest(p.name, p.id)}
                >
                  {testingId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Test
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

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
  { name: "Supabase", status: "active", description: "Cloud database — connected", apiKey: "Connected", icon: Globe },
];

/* ─── Document System links ─── */
const docSystemLinks = [
  { path: "/template-manager", label: "Templates", desc: "Manage document templates for quotes, proposals, and SLAs", icon: Layers, count: "12 templates" },
  { path: "/variables", label: "Variables", desc: "Define and manage custom variables used in document tokens", icon: Variable, count: "48 variables" },
  { path: "/block-library", label: "Block Library", desc: "Reusable content blocks shared across templates", icon: BookOpen, count: "24 blocks" },
  { path: "/block-builder", label: "Block Builder", desc: "Visual block editor for creating new content blocks", icon: Blocks, count: "Builder" },
  { path: "/branding-profiles", label: "Branding", desc: "Brand profiles controlling colors, fonts, and logos on documents", icon: Palette, count: "3 profiles" },
  { path: "/documents", label: "Document Vault", desc: "Central vault for all compiled documents, PDFs, and output files", icon: FileText, count: "Vault" },
];

/* ─── Automation links ─── */
const automationLinks = [
  { path: "/bot-registry", label: "Bot Governance", desc: "Manage AI bots, permissions, and authority boundaries", icon: Bot, count: "5 bots" },
  { path: "/bot-builder", label: "Bot Builder", desc: "Visual builder for creating and configuring AI bots", icon: Wrench, count: "Builder" },
  { path: "/signal-engine", label: "Signal Engine", desc: "Configure automated signals, alerts, and escalation triggers", icon: Radio, count: "12 signals" },
  { path: "/bot-audit", label: "Bot Audit", desc: "Review all bot actions, decisions, and override attempts", icon: Activity, count: "Audit log" },
  { path: "/crm-sync", label: "CRM Sync", desc: "Manage CRM synchronization, field mapping, and sync status", icon: Link2, count: "Sync" },
];

/* ─── ECR links ─── */
const ecrLinks = [
  { path: "/ecr", label: "ECR Dashboard", desc: "Customer rating overview with risk scores and trends", icon: BarChart3, count: "11 customers" },
  { path: "/ecr-rule-sets", label: "Rule Sets", desc: "Configure scoring rules for customer evaluation", icon: Layers, count: "4 rule sets" },
  { path: "/ecr-scoring", label: "Scoring", desc: "View and manage individual customer scores", icon: Star, count: "Scores" },
  { path: "/ecr-connectors", label: "Connectors", desc: "Data source connectors for external rating inputs", icon: Link2, count: "3 connectors" },
  { path: "/ecr-metrics", label: "Metrics", desc: "ECR performance metrics and analytics", icon: Database, count: "Metrics" },
  { path: "/ecr-snapshots", label: "Snapshots", desc: "Point-in-time ECR snapshots for audit and comparison", icon: Database, count: "Snapshots" },
  { path: "/ecr-upgrades", label: "Upgrades", desc: "Customer grade upgrade requests and approval workflow", icon: Star, count: "Upgrades" },
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

/* ─── Role configuration ─── */
const roleOptions = [
  { value: "admin", label: "Admin (CEO/CFO)" },
  { value: "commercial_director", label: "Commercial Director" },
  { value: "operations_director", label: "Operations Director" },
  { value: "regional_sales_head", label: "Regional Sales Head" },
  { value: "regional_ops_head", label: "Regional Ops Head" },
  { value: "salesman", label: "Salesman" },
  { value: "finance", label: "Finance" },
  { value: "legal", label: "Legal" },
];

const departmentOptions = [
  "Management", "Sales", "Operations", "Finance", "Legal", "IT",
];

const regionOptions = [
  { value: "All", label: "All Regions" },
  { value: "East", label: "Eastern Province" },
  { value: "Central", label: "Central Province" },
  { value: "West", label: "Western Province" },
];

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

/* ─── Edit User Modal ─── */
function EditUserModal({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [department, setDepartment] = useState(user.department || "");
  const [region, setRegion] = useState(user.region || "All");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    const result = await adminUpdateUser({
      userId: user.id,
      authId: user.auth_id,
      name: name.trim(),
      email: email.trim(),
      role,
      department,
      region,
    });
    setSaving(false);
    if (result.success) {
      toast.success("User updated", { description: `${name} — ${role.replace(/_/g, " ")}` });
      onSaved();
      onClose();
    } else {
      toast.error("Failed to update user", { description: result.error });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-serif">Edit User</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Full Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departmentOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {regionOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Reset Password Modal ─── */
function ResetPasswordModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    const result = await adminResetPassword(user.auth_id, password);
    setSaving(false);
    if (result.success) {
      toast.success("Password reset", { description: `New password set for ${user.name}` });
      onClose();
    } else {
      toast.error("Failed to reset password", { description: result.error });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-serif">Reset Password</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-[var(--color-hala-navy)] text-white flex items-center justify-center text-xs font-bold">
              {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">New Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleReset} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
              Reset Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPanel() {
  const { data: users, loading, refetch } = useUsers();
  const { appUser } = useAuth();
  const [userSearch, setUserSearch] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);

  // Add user form state
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("salesman");
  const [newUserDepartment, setNewUserDepartment] = useState("Sales");
  const [newUserRegion, setNewUserRegion] = useState("East");
  const [newUserPassword, setNewUserPassword] = useState("Hala2026!");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addingUser, setAddingUser] = useState(false);

  const isAdmin = appUser?.role === "admin";

  const handleAddUser = useCallback(async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (newUserPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setAddingUser(true);
    const result = await adminCreateUser({
      email: newUserEmail.trim(),
      password: newUserPassword,
      name: newUserName.trim(),
      role: newUserRole,
      department: newUserDepartment,
      region: newUserRegion,
    });
    setAddingUser(false);
    if (result.success) {
      toast.success("User created", {
        description: `${newUserName} (${newUserEmail}) — ${newUserRole.replace(/_/g, " ")}`,
      });
      setShowAddUser(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("salesman");
      setNewUserDepartment("Sales");
      setNewUserRegion("East");
      setNewUserPassword("Hala2026!");
      refetch();
    } else {
      toast.error("Failed to create user", { description: result.error });
    }
  }, [newUserName, newUserEmail, newUserPassword, newUserRole, newUserDepartment, newUserRegion, refetch]);

  const handleDeactivate = useCallback(async (user: any) => {
    if (user.id === appUser?.id) {
      toast.error("You cannot deactivate your own account");
      return;
    }
    const result = await adminDeactivateUser(user.auth_id, user.id);
    if (result.success) {
      toast.success("User deactivated", { description: `${user.name} can no longer sign in` });
      refetch();
    } else {
      toast.error("Failed to deactivate user", { description: result.error });
    }
  }, [appUser, refetch]);

  const handleReactivate = useCallback(async (user: any) => {
    const result = await adminReactivateUser(user.auth_id, user.id);
    if (result.success) {
      toast.success("User reactivated", { description: `${user.name} can now sign in again` });
      refetch();
    } else {
      toast.error("Failed to reactivate user", { description: result.error });
    }
  }, [refetch]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  const filteredUsers = users.filter((u: any) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

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
          <TabsTrigger value="ai-providers"><Brain className="w-3.5 h-3.5 mr-1.5" />AI Providers</TabsTrigger>
          <TabsTrigger value="editor-bots"><Zap className="w-3.5 h-3.5 mr-1.5" />Editor Bots</TabsTrigger>
          <TabsTrigger value="knowledgebase"><Database className="w-3.5 h-3.5 mr-1.5" />Knowledgebase</TabsTrigger>
          <TabsTrigger value="crm-sync"><Link2 className="w-3.5 h-3.5 mr-1.5" />CRM Sync</TabsTrigger>
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

        {/* ─── Users Tab — Full CRUD ─── */}
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Refresh
              </Button>
              {isAdmin && (
                <Button size="sm" onClick={() => setShowAddUser(!showAddUser)}>
                  <UserPlus className="w-4 h-4 mr-1.5" /> Add User
                </Button>
              )}
            </div>
          </div>

          {/* ─── Add User Form ─── */}
          {showAddUser && (
            <Card className="border-2 border-primary/20 shadow-none">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Create New Team Member</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Full Name *</Label>
                    <Input placeholder="e.g., Ahmed Al-Rashidi" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Email *</Label>
                    <Input type="email" placeholder="e.g., ahmed@company.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Initial Password</Label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        value={newUserPassword}
                        onChange={e => setNewUserPassword(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Role</Label>
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Department</Label>
                    <Select value={newUserDepartment} onValueChange={setNewUserDepartment}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Region</Label>
                    <Select value={newUserRegion} onValueChange={setNewUserRegion}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {regionOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setShowAddUser(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleAddUser} disabled={addingUser}>
                    {addingUser ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                    Create User
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Users Table ─── */}
          <Card className="border border-border shadow-none">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">User</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Role</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Department</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Region</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user: any) => {
                    const isInactive = user.status === "inactive";
                    return (
                      <tr key={user.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${isInactive ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isInactive ? "bg-gray-300 text-gray-600" : "bg-[var(--color-hala-navy)] text-white"}`}>
                              {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
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
                        <td className="px-4 py-3 text-sm text-muted-foreground">{user.department || "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{user.region || "All"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] ${isInactive ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                            {isInactive ? "Inactive" : "Active"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit user" onClick={() => setEditingUser(user)}>
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Reset password" onClick={() => setResetPasswordUser(user)}>
                                <Lock className="w-3.5 h-3.5" />
                              </Button>
                              {isInactive ? (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700" title="Reactivate user" onClick={() => handleReactivate(user)}>
                                  <UserCheck className="w-3.5 h-3.5" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" title="Deactivate user" onClick={() => handleDeactivate(user)}>
                                  <UserX className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Admin only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No users match your search.
                </div>
              )}
            </CardContent>
          </Card>

          {!isAdmin && (
            <p className="text-xs text-muted-foreground text-center">
              Only Admin users can create, edit, or deactivate team members.
            </p>
          )}
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
                Configure
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

        {/* ─── AI Providers Tab ─── */}
        <TabsContent value="ai-providers" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold">AI Provider Configuration</h2>
              <p className="text-xs text-muted-foreground">Manage AI model providers, or open the full management page</p>
            </div>
            <Link href="/ai-providers">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                Open Full Page
                <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <AIProvidersEmbed />
        </TabsContent>

        {/* ─── Editor Bots Tab ─── */}
        <TabsContent value="editor-bots" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold">Editor AI Bots</h2>
              <p className="text-xs text-muted-foreground">Manage bots used in the Document Composer for block and document-level AI generation</p>
            </div>
            <Link href="/editor-bot-builder">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Open Full Page
                <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-[#1B2A4A]">8</div>
                <div className="text-xs text-muted-foreground">Total Editor Bots</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">4</div>
                <div className="text-xs text-muted-foreground">Block Bots</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">4</div>
                <div className="text-xs text-muted-foreground">Document Bots</div>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">Use the full page to create, edit, test, and manage editor bots with system prompts, provider configuration, and document type permissions.</p>
        </TabsContent>

        <TabsContent value="knowledgebase" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold">Knowledgebase</h2>
              <p className="text-xs text-muted-foreground">Manage document collections used by AI bots for context retrieval and citations</p>
            </div>
            <Link href="/knowledgebase">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Database className="w-3.5 h-3.5" />
                Open Full Page
                <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <KnowledgebaseEmbed />
        </TabsContent>

        <TabsContent value="crm-sync" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold">CRM Sync Console</h2>
              <p className="text-xs text-muted-foreground">Bi-directional CRM integration — Zoho CRM + DNA Supersystems</p>
            </div>
            <Link href="/crm-sync-console">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Open Full Page
                <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <CRMSyncEmbed />
        </TabsContent>
      </Tabs>

      {/* ─── Modals ─── */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => refetch()}
        />
      )}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
        />
      )}
    </div>
  );
}
