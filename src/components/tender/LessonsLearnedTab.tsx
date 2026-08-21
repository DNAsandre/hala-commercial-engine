/**
 * LessonsLearnedTab — Tab 2 of Lost/Withdrawn Stage
 *
 * Capture lessons from this tender outcome.
 * What went well, what went wrong, recommendations.
 *
 * Data: type_details.lost_withdrawn_data.lessons_learned
 * No AI. No mock data.
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Info, BookOpen, Plus } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderLostWithdrawnData } from "@/lib/supabase-tender-actions";
import { reportSaveOutcome, wsRevisionToken } from "./tender-save-outcome";

interface Props {
  ws: TenderWorkspace;
  reload: () => void;
  /** TCW-T4 (C3): lets the stage shell render the real Unsaved/Saved badge. */
  onDirtyChange?: (dirty: boolean) => void;
}

interface Lesson {
  id: string;
  category: string;
  description: string;
  impact: string;
  recommendation: string;
}

const LESSON_CATEGORIES = [
  { value: "pricing", label: "Pricing / Commercial" },
  { value: "technical", label: "Technical Solution" },
  { value: "process", label: "Process / Timeline" },
  { value: "compliance", label: "Compliance / Documentation" },
  { value: "relationship", label: "Client Relationship" },
  { value: "team", label: "Team / Resources" },
  { value: "strategy", label: "Strategy / Positioning" },
  { value: "other", label: "Other" },
] as const;

const IMPACT_LEVELS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

export default function LessonsLearnedTab({ ws, reload, onDirtyChange }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.lost_withdrawn_data?.lessons_learned ?? {};

  const [whatWentWell, setWhatWentWell] = useState(saved.what_went_well || "");
  const [whatWentWrong, setWhatWentWrong] = useState(saved.what_went_wrong || "");
  const [lessons, setLessons] = useState<Lesson[]>(Array.isArray(saved.lessons) ? saved.lessons : []);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => { setDirty(true); onDirtyChange?.(true); };

  const addLesson = () => {
    setLessons(prev => [...prev, {
      id: `lsn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: "pricing", description: "", impact: "medium", recommendation: "",
    }]);
    mark();
  };

  const updateLesson = (id: string, field: keyof Lesson, value: string) => {
    setLessons(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l)); mark();
  };
  const removeLesson = (id: string) => { setLessons(prev => prev.filter(l => l.id !== id)); mark(); };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = { what_went_well: whatWentWell, what_went_wrong: whatWentWrong, lessons };
      const res = await updateTenderLostWithdrawnData(tenderId, "lessons_learned", payload, `${lessons.length} lessons captured`, wsRevisionToken(ws));
      // P2a threading + honest outcome; stale keeps the entry on screen.
      if (!reportSaveOutcome(res, "Lessons learned saved.")) return;
      setDirty(false); onDirtyChange?.(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [whatWentWell, whatWentWrong, lessons, tenderId, reload, ws, onDirtyChange]);

  const impactColor = (i: string) => {
    if (i === "critical") return "border-red-300 text-red-700 bg-red-50";
    if (i === "high") return "border-amber-300 text-amber-700 bg-amber-50";
    if (i === "medium") return "border-blue-200 text-blue-700 bg-blue-50";
    return "border-slate-200 text-slate-500 bg-slate-50";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <BookOpen className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Capture what went well and what went wrong. These lessons feed into future tender strategy and training.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Lessons</span>
        <Badge variant="outline" className="text-[8px]">{lessons.length} captured</Badge>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* What went well / wrong */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-emerald-200 shadow-none">
          <CardHeader className="py-2 px-4 bg-emerald-50/50 border-b border-emerald-100">
            <span className="text-xs font-semibold text-emerald-800">What Went Well</span>
          </CardHeader>
          <CardContent className="p-4">
            <Textarea className="text-xs min-h-[80px]" value={whatWentWell} onChange={e => { setWhatWentWell(e.target.value); mark(); }} placeholder="Aspects of the bid that were strong..." />
          </CardContent>
        </Card>
        <Card className="border-red-200 shadow-none">
          <CardHeader className="py-2 px-4 bg-red-50/50 border-b border-red-100">
            <span className="text-xs font-semibold text-red-800">What Went Wrong</span>
          </CardHeader>
          <CardContent className="p-4">
            <Textarea className="text-xs min-h-[80px]" value={whatWentWrong} onChange={e => { setWhatWentWrong(e.target.value); mark(); }} placeholder="Aspects that caused failure or weakness..." />
          </CardContent>
        </Card>
      </div>

      {/* Structured Lessons */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Structured Lessons</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addLesson}><Plus className="w-3 h-3" /> Add Lesson</Button>
        </CardHeader>
        <CardContent className="p-0">
          {lessons.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No lessons captured yet. Click "Add Lesson" to start.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {lessons.map((lesson, idx) => (
                <div key={lesson.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground">Lesson {idx + 1}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeLesson(lesson.id)}>×</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-[10px] font-semibold text-muted-foreground">Category</label>
                      <Select value={lesson.category} onValueChange={v => updateLesson(lesson.id, "category", v)}>
                        <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{LESSON_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><label className="text-[10px] font-semibold text-muted-foreground">Impact</label>
                      <Select value={lesson.impact} onValueChange={v => updateLesson(lesson.id, "impact", v)}>
                        <SelectTrigger className={`h-7 text-[10px] mt-1 ${impactColor(lesson.impact)}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{IMPACT_LEVELS.map(i => <SelectItem key={i.value} value={i.value} className="text-xs">{i.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><label className="text-[10px] font-semibold text-muted-foreground">Description</label>
                    <Textarea className="text-xs mt-1 min-h-[40px]" value={lesson.description} onChange={e => updateLesson(lesson.id, "description", e.target.value)} placeholder="What happened and why..." /></div>
                  <div><label className="text-[10px] font-semibold text-muted-foreground">Recommendation</label>
                    <Input className="h-7 text-[10px] mt-1" value={lesson.recommendation} onChange={e => updateLesson(lesson.id, "recommendation", e.target.value)} placeholder="What should we do differently next time?" /></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
