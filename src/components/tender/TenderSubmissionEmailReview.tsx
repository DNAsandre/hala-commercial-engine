/**
 * TND-008: Tender Submission Email Review
 * Read-only email record review for Bulk/PGP separate submission threads.
 */
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, XCircle, Mail, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  type TenderWorkspace,
  type TenderSubmissionEmail,
  type SubmissionEmailType,
  getEmailStatusLabel,
  getEmailStatusColor,
  getEmailTypeLabel,
  getAttachmentStatusLabel,
  getAttachmentStatusColor,
} from "@/lib/tender-workspace-data";

// â”€â”€â”€ MAIN COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function TenderSubmissionEmailReview({ ws, onClose, tenderId, reload }: { ws: TenderWorkspace; onClose: () => void; tenderId: string; reload: () => void }) {
  const [emailType, setEmailType] = useState<SubmissionEmailType>("bulk_submission");
  const [submissions] = useState<TenderSubmissionEmail[]>(ws.submissionEmails && ws.submissionEmails.length > 0 ? ws.submissionEmails : []);

  // Require explicit Supabase records; the review surface does not create frontend fallback emails.
  const hasSupabaseEmails = ws.submissionEmails && ws.submissionEmails.length > 0;
  const supabaseEmail = hasSupabaseEmails ? (ws.submissionEmails ?? []).find(e => e.emailType === emailType) : null;

  // If this email type is missing, show a clean source-of-truth empty state.
  const email = supabaseEmail
    ?? (hasSupabaseEmails && !supabaseEmail ? null : null); // null = will show error state below

  const missingCount = email ? email.attachments.filter(a => a.status === "missing").length : 0;
  const warningCount = email ? email.attachments.filter(a => a.status === "warning").length : 0;
  const totalSizeMb = email ? email.attachments.reduce((s, a) => s + a.sizeMb, 0) : 0;
  const isBundle = emailType === "test_bundle";

  // No email type in Supabase: show explicit empty state.
  if (hasSupabaseEmails && !supabaseEmail) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-background rounded-xl border shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-sm font-serif font-bold">Submission Email Review</h3>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><XCircle className="w-4 h-4" /></Button>
          </div>
          <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-800 font-medium">Supabase submission email data not found for: {getEmailTypeLabel(emailType as SubmissionEmailType)}</p>
            <p className="text-xs text-amber-600 mt-1">No verified submission email record is linked for this submission type yet.</p>
          </div>
          <div className="flex justify-end mt-4"><Button variant="outline" size="sm" onClick={onClose}>Close</Button></div>
        </div>
      </div>
    );
  }

  // No Supabase data at all: show explicit empty state.
  if (!hasSupabaseEmails) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-background rounded-xl border shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-sm font-serif font-bold">Submission Email Review</h3>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><XCircle className="w-4 h-4" /></Button>
          </div>
          <div className="p-4 rounded-lg border border-red-200 bg-red-50">
            <p className="text-sm text-red-800 font-medium">Supabase submission email data not found.</p>
            <p className="text-xs text-red-600 mt-1">No verified submission email records are linked to this tender yet.</p>
          </div>
          <div className="flex justify-end mt-4"><Button variant="outline" size="sm" onClick={onClose}>Close</Button></div>
        </div>
      </div>
    );
  }
  // At this point, we have Supabase data AND a matching email for this type.
  // TypeScript needs an explicit guard to narrow `email` from nullable.
  if (!email) {
    // Should never reach here â€” the early returns above handle all null cases.
    return null;
  }

  // Capture narrowed non-null email for use inside closures (TS can't narrow across closures)
  const safeEmail = email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-xl border shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-serif font-bold flex items-center gap-2"><Mail className="w-4 h-4" /> Submission Email Review</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Verified records only. No external email is sent.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><XCircle className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Review banner */}
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">Review only: no external email is sent and no submission record is created here.</p>
          </div>

          {/* Separate thread rule */}
          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <p className="text-[10px] text-blue-700">Submission policy: Bulk and PGP are reviewed as separate emails and separate threads. This surface reviews records only.</p>
          </div>

          {/* Email type selection */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Submission Type</label>
            <Select value={emailType} onValueChange={(v) => setEmailType(v as SubmissionEmailType)}>
              <SelectTrigger size="sm" className="w-[260px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bulk_submission" className="text-xs">Bulk Transportation Pack</SelectItem>
                <SelectItem value="pgp_submission" className="text-xs">PGP Transportation Pack</SelectItem>
                <SelectItem value="test_bundle" className="text-xs">Combined Bundle (Warning)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bundle warning */}
          {isBundle && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50">
              <p className="text-xs text-red-700 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Warning: Bulk and PGP should be submitted as separate email threads. This combined bundle would require correction before submission.</p>
            </div>
          )}

          {/* Email preview */}
          <div className="space-y-3">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Email Preview</label>
            <div className="border rounded-lg p-4 space-y-2.5 bg-muted/20">
              <div className="grid grid-cols-[60px_1fr] gap-1 text-xs">
                <span className="text-muted-foreground font-medium">To:</span><span>{safeEmail.to}</span>
                {safeEmail.ccExternal && <><span className="text-muted-foreground font-medium">CC:</span><span>{safeEmail.ccExternal}</span></>}
                <span className="text-muted-foreground font-medium">CC Int:</span><span className="text-muted-foreground">{safeEmail.ccInternal}</span>
                <span className="text-muted-foreground font-medium">Subject:</span><span className="font-medium">{safeEmail.subject}</span>
              </div>
              <div className="border-t pt-2.5">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{safeEmail.body}</pre>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>CRM Sync: <span className="font-medium">Not connected</span></span>
                <span>Status: <span className="font-medium">{getEmailStatusLabel(safeEmail.status)}</span></span>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Attachments</label>
              <span className="text-[10px] text-muted-foreground">{safeEmail.attachments.length} files Â· {totalSizeMb.toFixed(1)} MB</span>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">File</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-left font-semibold">Format</th>
                    <th className="px-3 py-2 text-center font-semibold">Req.</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {safeEmail.attachments.map(a => (
                    <tr key={a.id} className={`border-t border-border ${a.status === "missing" ? "bg-red-50/40 border-l-2 border-l-red-400" : a.status === "warning" ? "bg-amber-50/20 border-l-2 border-l-amber-300" : ""}`}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{a.fileName}</p>
                        {a.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{a.notes}</p>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{a.documentType}</td>
                      <td className="px-3 py-2 text-muted-foreground">{a.format}</td>
                      <td className="px-3 py-2 text-center">{a.required ? <Badge variant="outline" className="text-[8px]">Required</Badge> : "â€”"}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${getAttachmentStatusColor(a.status)}`}>{getAttachmentStatusLabel(a.status)}</Badge></td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{a.sizeMb > 0 ? `${a.sizeMb} MB` : "â€”"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {missingCount > 0 && (
              <div className="mt-2 p-2 rounded-md border border-amber-200 bg-amber-50/50">
                <p className="text-[10px] text-amber-700">{missingCount} required attachment(s) missing. Would require correction before production submission.</p>
              </div>
            )}
          </div>

          {/* Submission register */}
          {submissions.length > 0 && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Submission Record Log</label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Type</th>
                      <th className="px-3 py-2 text-left font-semibold">Subject</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-left font-semibold">Recorded At</th>
                      <th className="px-3 py-2 text-left font-semibold">By</th>
                      <th className="px-3 py-2 text-center font-semibold">Warn</th>
                      <th className="px-3 py-2 text-left font-semibold">CRM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(s => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">{getEmailTypeLabel(s.emailType)}</Badge></td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{s.subject}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${getEmailStatusColor(s.status)}`}>{getEmailStatusLabel(s.status)}</Badge></td>
                        <td className="px-3 py-2 text-muted-foreground text-[10px] font-mono">{s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString() : "â€”"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.submittedBy}</td>
                        <td className="px-3 py-2 text-center font-mono">{s.warningsCount}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.crmSyncStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex items-center justify-end">
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
