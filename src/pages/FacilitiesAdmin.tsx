/**
 * FacilitiesAdmin — Admin module for managing warehouses/facilities.
 *
 * CRUD against the `facilities` Supabase table.
 * No hardcoded data. All names come from the database.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Warehouse, Save, X, Loader2 } from "lucide-react";

import { readFacilities, type FacilityRecord, type RecordRead } from "@/lib/ops-runtime";

export default function FacilitiesAdmin() {
  /* SC-01 Wave 04: the previous loader toasted on error and left `facilities`
   * as [], so a failed read rendered the "No facilities found. Run the
   * intake002_facilities migration…" empty state — telling an administrator to
   * run a migration when the table may be fully populated. */
  const [read, setRead] = useState<RecordRead<FacilityRecord> | null>(null);
  const facilities = read?.rows ?? [];
  const loading = read === null;

  // New facility form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editRegion, setEditRegion] = useState("");

  async function load() {
    setRead(null);
    const result = await readFacilities();
    setRead(result);
    if (result.status === "error" || result.status === "unavailable") {
      toast.error("Failed to load facilities", { description: result.error });
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!newName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const maxOrder = facilities.reduce((m, f) => Math.max(m, f.sortOrder), 0);
    const { error } = await supabase.from("facilities").insert({
      name: newName.trim(),
      code: newCode.trim() || null,
      region: newRegion || null,
      sort_order: maxOrder + 1,
    });
    if (error) {
      toast.error("Failed to add facility", { description: error.message });
    } else {
      toast.success(`Added: ${newName.trim()}`);
      setNewName(""); setNewCode(""); setNewRegion(""); setShowAdd(false);
      load();
    }
    setSaving(false);
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) { toast.error("Name is required"); return; }
    const { error } = await supabase.from("facilities").update({
      name: editName.trim(),
      code: editCode.trim() || null,
      region: editRegion || null,
    }).eq("id", id);
    if (error) {
      toast.error("Failed to update", { description: error.message });
    } else {
      toast.success("Updated");
      setEditId(null);
      load();
    }
  }

  async function toggleActive(f: FacilityRecord) {
    const { error } = await supabase.from("facilities")
      .update({ active: !f.active }).eq("id", f.id);
    if (error) {
      toast.error("Failed to toggle", { description: error.message });
    } else {
      load();
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Warehouse className="h-5 w-5 text-[#1B2A4A]" />
          <h1 className="text-xl font-semibold">Facilities & Warehouses</h1>
          <Badge variant="outline" className="text-xs">
            {read !== null && (read.status === "loaded" || read.status === "empty")
              ? `${facilities.filter(f => f.active).length} active of ${facilities.length} read`
              : read === null ? "reading…" : "count unknown"}
          </Badge>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1 bg-[#1B2A4A] hover:bg-[#1B2A4A]/90">
          <Plus className="h-3 w-3" /> Add Facility
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="border rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
          <p className="text-sm font-medium">New Facility</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Name *</Label>
              <Input placeholder="e.g. Jubail (JUB3)" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <Label>Code</Label>
              <Input placeholder="e.g. JUB3" value={newCode} onChange={e => setNewCode(e.target.value)} />
            </div>
            <div>
              <Label>Region</Label>
              <Select value={newRegion} onValueChange={setNewRegion}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="East">East</SelectItem>
                  <SelectItem value="Central">Central</SelectItem>
                  <SelectItem value="West">West</SelectItem>
                  <SelectItem value="Global">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading facilities...
        </div>
      ) : read !== null && (read.status === "error" || read.status === "unavailable") ? (
        <div className="border border-red-200 bg-red-50/40 rounded-lg p-6 space-y-2">
          <p className="text-sm font-semibold text-red-700">Facility records could not be read</p>
          <p className="text-xs text-muted-foreground">
            No facilities are listed. The number of recorded facilities is unknown — it is not zero, and no migration
            is implied.
          </p>
          <p className="text-[11px] font-mono text-muted-foreground break-all">{read.error}</p>
          <Button size="sm" variant="outline" onClick={() => load()}>Retry</Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium">#</th>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Code</th>
                <th className="text-left px-4 py-2 font-medium">Region</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f, i) => (
                <tr key={f.id} className={`border-b last:border-0 ${!f.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                  {editId === f.id ? (
                    <>
                      <td className="px-4 py-2">
                        <Input className="h-7 text-xs" value={editName} onChange={e => setEditName(e.target.value)} />
                      </td>
                      <td className="px-4 py-2">
                        <Input className="h-7 text-xs" value={editCode} onChange={e => setEditCode(e.target.value)} />
                      </td>
                      <td className="px-4 py-2">
                        <Select value={editRegion} onValueChange={setEditRegion}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="East">East</SelectItem>
                            <SelectItem value="Central">Central</SelectItem>
                            <SelectItem value="West">West</SelectItem>
                            <SelectItem value="Global">Global</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={f.active ? "default" : "secondary"}>
                          {f.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right space-x-1">
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleSaveEdit(f.id)}>
                          <Save className="h-3 w-3 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditId(null)}>
                          Cancel
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-medium">{f.name}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{f.code || "—"}</td>
                      <td className="px-4 py-2">{f.region || "—"}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={f.active ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => toggleActive(f)}
                        >
                          {f.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          size="sm" variant="ghost" className="h-6 text-xs"
                          onClick={() => { setEditId(f.id); setEditName(f.name); setEditCode(f.code || ""); setEditRegion(f.region || ""); }}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {facilities.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    The read succeeded and no facility records are visible to this account. Records hidden by
                    row-level security would not appear here. Use "Add Facility" to record one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
