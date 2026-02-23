/*
 * CreateWorkspaceDialog — Manual workspace creation
 * Allows creating workspaces without CRM sync
 * Full form with customer selection, deal details, and initial stage
 */

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Workspace, type Region } from "@/lib/store";
import { useCustomers, useWorkspaces, useUsers } from "@/hooks/useSupabase";
import { useCreateWorkspace } from "@/hooks/useMutations";
import { logAuditAction } from "@/hooks/useMutations";
import { nanoid } from "nanoid";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export default function CreateWorkspaceDialog({ open, onOpenChange, onCreated }: Props) {
  const { data: customers } = useCustomers();
  const { data: workspaces } = useWorkspaces();
  const { data: users } = useUsers();
  const createWs = useCreateWorkspace();
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState<Region>("East");
  const [owner, setOwner] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [palletVolume, setPalletVolume] = useState("");
  const [notes, setNotes] = useState("");
  const [crmDealId, setCrmDealId] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");

  const activeCustomers = customers.filter((c: any) => c.status === "Active");
  const salesUsers = users.filter((u: any) => ["salesman", "regional_sales_head", "admin"].includes(u.role));

  const selectedCustomer = customers.find((c: any) => c.id === customerId);

  function handleSubmit() {
    if (!isNew && !customerId) {
      toast.error("Please select a customer");
      return;
    }
    if (isNew && !newCustomerName.trim()) {
      toast.error("Please enter the new customer name");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a workspace title");
      return;
    }
    if (!owner) {
      toast.error("Please select an owner");
      return;
    }

    const customerName = isNew ? newCustomerName.trim() : (selectedCustomer?.name || "Unknown");
    const now = new Date().toISOString().split("T")[0];

    const newWorkspace: Workspace = {
      id: `w${nanoid(6)}`,
      customerId: isNew ? `c_new_${nanoid(4)}` : customerId,
      customerName,
      title: title.trim(),
      stage: "qualified",
      crmDealId: crmDealId.trim() || undefined,
      crmStage: crmDealId.trim() ? "qualified" : undefined,
      createdAt: now,
      updatedAt: now,
      owner: owner,
      region,
      estimatedValue: parseFloat(estimatedValue) || 0,
      palletVolume: parseInt(palletVolume) || 0,
      gpPercent: 0,
      ragStatus: "green",
      daysInStage: 0,
      approvalState: "not_required",
      notes: notes.trim(),
    };

    createWs.mutate(newWorkspace).then(result => {
      if (result) {
        // Log audit entry
        logAuditAction("workspace", newWorkspace.id, "created", "u1", "Amin Al-Rashid", `Workspace "${title.trim()}" created for ${customerName}`);
        toast.success("Workspace created", {
          description: `${customerName} — ${title.trim()}`,
        });
        // Reset form
        setCustomerId("");
        setTitle("");
        setRegion("East");
        setOwner("");
        setEstimatedValue("");
        setPalletVolume("");
        setNotes("");
        setCrmDealId("");
        setIsNew(false);
        setNewCustomerName("");
        onOpenChange(false);
        onCreated?.();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Create New Workspace</DialogTitle>
          <DialogDescription className="text-xs">
            Manually create a commercial workspace. Workspaces can also be auto-created from Zoho CRM when a deal reaches "Qualified" stage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Customer Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</Label>
              <button
                type="button"
                onClick={() => setIsNew(!isNew)}
                className="text-xs text-primary hover:underline"
              >
                {isNew ? "Select existing customer" : "New customer"}
              </button>
            </div>

            {isNew ? (
              <Input
                placeholder="Enter new customer name"
                value={newCustomerName}
                onChange={e => setNewCustomerName(e.target.value)}
              />
            ) : (
              <Select value={customerId} onValueChange={v => {
                setCustomerId(v);
                const c = customers.find(c => c.id === v);
                if (c) setRegion(c.region);
              }}>
                <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                <SelectContent>
                  {activeCustomers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span>{c.name}</span>
                        <span className="text-muted-foreground text-xs">— {c.city}, {c.region}</span>
                        <span className={`text-[10px] font-mono ${c.grade === "A" ? "text-emerald-600" : c.grade === "B" ? "text-blue-600" : c.grade === "C" ? "text-amber-600" : "text-red-600"}`}>
                          Grade {c.grade}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedCustomer && !isNew && (
              <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/50 text-xs">
                <div><span className="text-muted-foreground">Industry:</span> <span className="font-medium">{selectedCustomer.industry}</span></div>
                <div><span className="text-muted-foreground">Grade:</span> <span className="font-medium">{selectedCustomer.grade}</span></div>
                <div><span className="text-muted-foreground">DSO:</span> <span className={`font-medium ${selectedCustomer.dso > 45 ? "text-red-600" : ""}`}>{selectedCustomer.dso} days</span></div>
                <div><span className="text-muted-foreground">Service:</span> <span className="font-medium">{selectedCustomer.serviceType}</span></div>
                <div><span className="text-muted-foreground">Facility:</span> <span className="font-medium">{selectedCustomer.facility}</span></div>
                <div><span className="text-muted-foreground">Contract:</span> <span className="font-medium">{selectedCustomer.contractExpiry}</span></div>
              </div>
            )}
          </div>

          {/* Workspace Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ws-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace Title</Label>
            <Input
              id="ws-title"
              placeholder="e.g., SABIC Jubail Expansion 3000PP"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Region</Label>
              <Select value={region} onValueChange={v => setRegion(v as Region)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="East">East</SelectItem>
                  <SelectItem value="Central">Central</SelectItem>
                  <SelectItem value="West">West</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner</Label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {salesUsers.map(u => (
                    <SelectItem key={u.id} value={u.name}>{u.name} — {u.role.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estimated Value (SAR)</Label>
              <Input
                type="number"
                placeholder="e.g., 3400000"
                value={estimatedValue}
                onChange={e => setEstimatedValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pallet Volume</Label>
              <Input
                type="number"
                placeholder="e.g., 2500"
                value={palletVolume}
                onChange={e => setPalletVolume(e.target.value)}
              />
            </div>
          </div>

          {/* CRM Link (optional) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Zoho CRM Deal ID <span className="text-muted-foreground font-normal normal-case">(optional — link to existing CRM deal)</span>
            </Label>
            <Input
              placeholder="e.g., ZH-4600"
              value={crmDealId}
              onChange={e => setCrmDealId(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea
              placeholder="Initial context, client requirements, urgency notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Create Workspace</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
