import { Link } from "wouter";
/*
 * Branding Profiles — Admin page for managing document branding/styler profiles
 * Create/edit brand profiles with colors, fonts, header/footer format, assets
 * Design: White cards, subtle borders, matching enterprise SaaS aesthetic
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Palette, Plus, Paintbrush, Type, Image, FileText, Settings2,
  Check, Copy, Trash2, Eye, ChevronDown, ChevronRight
, ArrowLeft } from "lucide-react";
import { brandingProfiles, type BrandingProfile, type FooterFormat } from "@/lib/document-composer";
import { useDocBrandingProfiles } from "@/hooks/useSupabase";
import { api } from "@/lib/api-client";

export default function BrandingProfilesPage() {
  // Live Supabase data
  const { data: liveBranding, error: brnError, refetch: refetchBranding } = useDocBrandingProfiles();
  const profiles = brnError ? brandingProfiles : liveBranding;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<BrandingProfile | null>(null);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formPrimary, setFormPrimary] = useState("#1a2744");
  const [formSecondary, setFormSecondary] = useState("#2a4a7f");
  const [formAccent, setFormAccent] = useState("#c9a84c");
  const [formFont, setFormFont] = useState("IBM Plex Sans");
  const [formHeadingFont, setFormHeadingFont] = useState("Source Serif 4");
  const [formHeaderStyle, setFormHeaderStyle] = useState<"full" | "minimal" | "branded">("full");
  const [formFooter, setFormFooter] = useState<FooterFormat>({
    show_ref: true, show_date: true, show_completed_by: true, show_page_numbers: true, custom_text: ""
  });

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error("Profile name is required"); return; }
    const payload = {
      name: formName.trim(),
      primary_color: formPrimary,
      secondary_color: formSecondary,
      accent_color: formAccent,
      font_family: formFont,
      font_heading: formHeadingFont,
      header_style: formHeaderStyle,
      footer_format: formFooter,
    };
    try {
      if (editingProfile) {
        await api.branding.update(editingProfile.id, payload);
        toast.success(`Branding profile "${formName}" updated`);
      } else {
        await api.branding.create(payload);
        toast.success(`Branding profile "${formName}" created`);
      }
      await refetchBranding();
      setShowCreateDialog(false);
      setEditingProfile(null);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save branding profile");
    }
  };

  const resetForm = () => {
    setFormName(""); setFormPrimary("#1a2744"); setFormSecondary("#2a4a7f");
    setFormAccent("#c9a84c"); setFormFont("IBM Plex Sans"); setFormHeadingFont("Source Serif 4");
    setFormHeaderStyle("full");
    setFormFooter({ show_ref: true, show_date: true, show_completed_by: true, show_page_numbers: true, custom_text: "" });
  };

  const openEdit = (profile: BrandingProfile) => {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormPrimary(profile.primary_color);
    setFormSecondary(profile.secondary_color);
    setFormAccent(profile.accent_color);
    setFormFont(profile.font_family);
    setFormHeadingFont(profile.font_heading);
    setFormHeaderStyle(profile.header_style);
    setFormFooter({ ...profile.footer_format });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-4">
        <Link href="/admin-panel">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A] font-serif">Branding Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage document styling — colors, typography, logos, headers, and footers</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
          <Plus size={14} className="mr-1.5" /> New Profile
        </Button>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Profiles", value: profiles.length, icon: Palette, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Font Families", value: Array.from(new Set(profiles.map(bp => bp.font_family))).length, icon: Type, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Header Styles", value: Array.from(new Set(profiles.map(bp => bp.header_style))).length, icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((m, i) => (
          <Card key={i} className="border border-gray-200 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                  <p className="text-2xl font-bold text-[#1B2A4A]">{m.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${m.bg}`}><m.icon size={18} className={m.color} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profile Cards */}
      <div className="space-y-3">
        {profiles.map((profile) => {
          const isExpanded = expandedId === profile.id;

          return (
            <Card key={profile.id} className="border border-gray-200 shadow-none hover:shadow-sm transition-shadow">
              <CardContent className="p-0">
                {/* Profile Header */}
                <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : profile.id)}>
                  {/* Color Preview Swatch */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex gap-0.5">
                      <div className="w-6 h-6 rounded-tl-lg" style={{ backgroundColor: profile.primary_color }} />
                      <div className="w-6 h-6 rounded-tr-lg" style={{ backgroundColor: profile.secondary_color }} />
                    </div>
                    <div className="flex gap-0.5">
                      <div className="w-6 h-6 rounded-bl-lg" style={{ backgroundColor: profile.accent_color }} />
                      <div className="w-6 h-6 rounded-br-lg bg-gray-100" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#1B2A4A]">{profile.name}</h3>
                      <Badge variant="outline" className="text-[10px] h-5 capitalize">{profile.header_style}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Type size={10} /> {profile.font_family} / {profile.font_heading}</span>
                      <span className="flex items-center gap-1"><Paintbrush size={10} /> {profile.primary_color}</span>
                      {profile.watermark_url && <span className="flex items-center gap-1"><Image size={10} /> Watermark</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); openEdit(profile); setShowCreateDialog(true); }}>
                      <Settings2 size={12} className="mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); toast.info("Feature coming soon"); }}>
                      <Copy size={14} />
                    </Button>
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/30">
                    <div className="grid grid-cols-3 gap-4">
                      {/* Colors */}
                      <div>
                        <h4 className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-wider mb-2">Color Palette</h4>
                        <div className="space-y-2">
                          {[
                            { label: "Primary", value: profile.primary_color },
                            { label: "Secondary", value: profile.secondary_color },
                            { label: "Accent", value: profile.accent_color },
                          ].map((c, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-100">
                              <div className="w-8 h-8 rounded" style={{ backgroundColor: c.value }} />
                              <div>
                                <p className="text-xs font-medium text-[#1B2A4A]">{c.label}</p>
                                <p className="text-[10px] text-gray-400 font-mono">{c.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Typography */}
                      <div>
                        <h4 className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-wider mb-2">Typography</h4>
                        <div className="space-y-2">
                          <div className="p-3 bg-white rounded border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Body Font</p>
                            <p className="text-lg font-medium text-[#1B2A4A]" style={{ fontFamily: profile.font_family }}>{profile.font_family}</p>
                            <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: profile.font_family }}>The quick brown fox jumps over the lazy dog</p>
                          </div>
                          <div className="p-3 bg-white rounded border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Heading Font</p>
                            <p className="text-lg font-medium text-[#1B2A4A]" style={{ fontFamily: profile.font_heading }}>{profile.font_heading}</p>
                            <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: profile.font_heading }}>The quick brown fox jumps over the lazy dog</p>
                          </div>
                        </div>
                      </div>

                      {/* Footer & Header */}
                      <div>
                        <h4 className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-wider mb-2">Header & Footer</h4>
                        <div className="p-3 bg-white rounded border border-gray-100 space-y-2 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Header Style</span><span className="font-medium capitalize">{profile.header_style}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Show Reference</span><span className="font-medium">{profile.footer_format.show_ref ? "Yes" : "No"}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Show Date</span><span className="font-medium">{profile.footer_format.show_date ? "Yes" : "No"}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Show Completed By</span><span className="font-medium">{profile.footer_format.show_completed_by ? "Yes" : "No"}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Page Numbers</span><span className="font-medium">{profile.footer_format.show_page_numbers ? "Yes" : "No"}</span></div>
                          {profile.footer_format.custom_text && (
                            <div className="pt-1 border-t border-gray-100">
                              <p className="text-gray-500 mb-0.5">Custom Footer Text</p>
                              <p className="text-[10px] text-gray-600 italic">{profile.footer_format.custom_text}</p>
                            </div>
                          )}
                        </div>

                        {/* Preview Mockup */}
                        <div className="mt-3 p-3 bg-white rounded border border-gray-100">
                          <p className="text-xs text-gray-500 mb-2">Document Preview</p>
                          <div className="border rounded overflow-hidden" style={{ borderColor: profile.primary_color + "40" }}>
                            <div className="h-6 flex items-center px-2" style={{ backgroundColor: profile.primary_color }}>
                              <span className="text-[8px] text-white font-medium">HALA SUPPLY CHAIN</span>
                              <span className="text-[8px] ml-auto" style={{ color: profile.accent_color }}>REF-001</span>
                            </div>
                            <div className="p-2 h-16 bg-white">
                              <div className="h-1.5 rounded-full mb-1" style={{ backgroundColor: profile.primary_color + "20", width: "60%" }} />
                              <div className="h-1 rounded-full mb-1 bg-gray-100 w-full" />
                              <div className="h-1 rounded-full mb-1 bg-gray-100 w-4/5" />
                              <div className="h-1 rounded-full bg-gray-100 w-3/5" />
                            </div>
                            <div className="h-4 flex items-center px-2 border-t" style={{ borderColor: profile.primary_color + "20" }}>
                              <span className="text-[6px] text-gray-400">Page 1 of 5</span>
                              <span className="text-[6px] text-gray-400 ml-auto">CONFIDENTIAL</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) setEditingProfile(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1B2A4A] font-serif">
              {editingProfile ? `Edit — ${editingProfile.name}` : "New Branding Profile"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Profile Name</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Hala Corporate — Navy" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={formPrimary} onChange={(e) => setFormPrimary(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  <Input value={formPrimary} onChange={(e) => setFormPrimary(e.target.value)} className="font-mono text-xs" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={formSecondary} onChange={(e) => setFormSecondary(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  <Input value={formSecondary} onChange={(e) => setFormSecondary(e.target.value)} className="font-mono text-xs" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={formAccent} onChange={(e) => setFormAccent(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  <Input value={formAccent} onChange={(e) => setFormAccent(e.target.value)} className="font-mono text-xs" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Body Font</label>
                <Select value={formFont} onValueChange={setFormFont}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IBM Plex Sans">IBM Plex Sans</SelectItem>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Roboto">Roboto</SelectItem>
                    <SelectItem value="Open Sans">Open Sans</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Heading Font</label>
                <Select value={formHeadingFont} onValueChange={setFormHeadingFont}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Source Serif 4">Source Serif 4</SelectItem>
                    <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Merriweather">Merriweather</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Header Style</label>
              <Select value={formHeaderStyle} onValueChange={(v) => setFormHeaderStyle(v as "full" | "minimal" | "branded")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full — Logo + title + reference</SelectItem>
                  <SelectItem value="minimal">Minimal — Reference only</SelectItem>
                  <SelectItem value="branded">Branded — Full-width color bar + logo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Footer Configuration</label>
              <div className="space-y-2 p-3 bg-gray-50 rounded border border-gray-100">
                {[
                  { key: "show_ref" as const, label: "Show Reference Number" },
                  { key: "show_date" as const, label: "Show Date" },
                  { key: "show_completed_by" as const, label: "Show Completed By" },
                  { key: "show_page_numbers" as const, label: "Show Page Numbers" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{item.label}</span>
                    <Switch checked={formFooter[item.key]} onCheckedChange={(v) => setFormFooter(prev => ({ ...prev, [item.key]: v }))} />
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-200">
                  <label className="text-xs text-gray-600 mb-1 block">Custom Footer Text</label>
                  <Input value={formFooter.custom_text} onChange={(e) => setFormFooter(prev => ({ ...prev, custom_text: e.target.value }))} placeholder="e.g., CONFIDENTIAL — For Authorized Use Only" className="text-xs" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingProfile(null); }}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
              {editingProfile ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
