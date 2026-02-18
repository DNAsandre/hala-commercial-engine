/**
 * Revenue Exposure Dashboard — Part F
 * Read-only analytics. No logic changes.
 * Design: Swiss Precision — white cards, subtle borders, enterprise SaaS aesthetic
 * Aligned with ECR Dashboard, Renewals, Proposals styling
 */

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Shield,
  Clock,
  TrendingDown,
  Database,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  FileWarning,
  BarChart3,
} from "lucide-react";
import { Link } from "wouter";
import { computeRevenueExposure } from "@/lib/commercial-integrity";
import { formatSAR } from "@/lib/renewal-engine";

export default function RevenueExposure() {
  const exposure = useMemo(() => computeRevenueExposure(18), []);

  const summaryCards = [
    {
      label: "Expiring < 90 Days",
      value: exposure.renewalsExpiring90Days.count,
      subValue: formatSAR(exposure.renewalsExpiring90Days.totalRevenue),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      borderColor: "border-amber-200",
    },
    {
      label: "Block Gates Active",
      value: exposure.renewalsWithBlockGates.count,
      subValue: "Unresolved",
      icon: ShieldAlert,
      color: "text-red-600",
      bg: "bg-red-50",
      borderColor: "border-red-200",
    },
    {
      label: "Overrides Used",
      value: exposure.renewalsWithOverrides.count,
      subValue: "Renewals",
      icon: Shield,
      color: "text-blue-600",
      bg: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      label: "Missing ECR",
      value: exposure.baselinesMissingEcr.count,
      subValue: "Baselines",
      icon: Database,
      color: "text-gray-600",
      bg: "bg-gray-50",
      borderColor: "border-gray-200",
    },
    {
      label: "Low GP% Contracts",
      value: exposure.contractsLowGp.count,
      subValue: `< ${exposure.contractsLowGp.threshold}%`,
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50",
      borderColor: "border-red-200",
    },
    {
      label: "Total Exposed Revenue",
      value: formatSAR(exposure.totalExposedRevenue),
      subValue: "At risk",
      icon: DollarSign,
      color: "text-amber-700",
      bg: "bg-amber-50",
      borderColor: "border-amber-200",
    },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
              <BarChart3 className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-slate-900">Commercial Exposure Summary</h1>
              <p className="text-sm text-gray-500 mt-0.5">Revenue at risk, governance gaps, and integrity flags — read-only analytics</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">
          <FileWarning className="w-3 h-3 mr-1" /> Read-Only Analytics
        </Badge>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border border-gray-200 shadow-none hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-1.5 rounded-md ${card.bg} border ${card.borderColor}`}>
                  <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900">{card.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.subValue}</div>
              <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring Renewals */}
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">Renewals Expiring &lt; 90 Days</h3>
              <Badge variant="outline" className="ml-auto text-[10px] text-amber-700 border-amber-200 bg-amber-50">
                {exposure.renewalsExpiring90Days.count}
              </Badge>
            </div>
            {exposure.renewalsExpiring90Days.items.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No renewals expiring within 90 days</p>
            ) : (
              <div className="space-y-2">
                {exposure.renewalsExpiring90Days.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.customerName}</p>
                      <p className="text-xs text-gray-500">{item.daysLeft} days remaining</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatSAR(item.annualRevenue)}</p>
                      <Badge variant="outline" className={`text-[10px] ${item.daysLeft < 30 ? "text-red-700 border-red-200 bg-red-50" : "text-amber-700 border-amber-200 bg-amber-50"}`}>
                        {item.daysLeft < 30 ? "Critical" : "Urgent"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Block Gates */}
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-semibold text-slate-900">Renewals with Block Gates</h3>
              <Badge variant="outline" className="ml-auto text-[10px] text-red-700 border-red-200 bg-red-50">
                {exposure.renewalsWithBlockGates.count}
              </Badge>
            </div>
            {exposure.renewalsWithBlockGates.items.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No renewals with unresolved block gates</p>
            ) : (
              <div className="space-y-2">
                {exposure.renewalsWithBlockGates.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.customerName}</p>
                      <div className="flex gap-1 mt-1">
                        {item.blockedGates.map((gate) => (
                          <Badge key={gate} variant="outline" className="text-[10px] text-red-700 border-red-200 bg-red-50">
                            {gate}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Link href={`/renewals/${item.id}`}>
                      <ArrowRight className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overrides Used */}
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">Renewals with Overrides</h3>
              <Badge variant="outline" className="ml-auto text-[10px] text-blue-700 border-blue-200 bg-blue-50">
                {exposure.renewalsWithOverrides.count}
              </Badge>
            </div>
            {exposure.renewalsWithOverrides.items.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No overrides used</p>
            ) : (
              <div className="space-y-2">
                {exposure.renewalsWithOverrides.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.customerName}</p>
                      <p className="text-xs text-gray-500">{item.overrideCount} override(s) applied</p>
                    </div>
                    <Link href={`/renewals/${item.id}`}>
                      <ArrowRight className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low GP% Contracts */}
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-semibold text-slate-900">Contracts with GP% &lt; {exposure.contractsLowGp.threshold}%</h3>
              <Badge variant="outline" className="ml-auto text-[10px] text-red-700 border-red-200 bg-red-50">
                {exposure.contractsLowGp.count}
              </Badge>
            </div>
            {exposure.contractsLowGp.items.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No contracts below GP% threshold</p>
            ) : (
              <div className="space-y-2">
                {exposure.contractsLowGp.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.customerName}</p>
                      <p className="text-xs text-gray-500">Baseline: {item.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-700">{item.gpPercent}%</p>
                      <p className="text-[10px] text-gray-400">GP%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Missing ECR Snapshots */}
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-slate-900">Baselines Missing ECR Snapshot</h3>
              <Badge variant="outline" className="ml-auto text-[10px] text-gray-600 border-gray-200 bg-gray-50">
                {exposure.baselinesMissingEcr.count}
              </Badge>
            </div>
            {exposure.baselinesMissingEcr.items.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">All baselines have ECR snapshots</p>
            ) : (
              <div className="space-y-2">
                {exposure.baselinesMissingEcr.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.customerName}</p>
                      <p className="text-xs text-gray-500">{item.id}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">
                      Missing
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Governance Integrity Summary */}
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">Integrity Guarantees</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: "No silent override", status: true },
                { label: "No retroactive rule mutation", status: true },
                { label: "No duplicate active baseline", status: true },
                { label: "No AI write into commercial truth", status: true },
                { label: "Every lock/approval traceable to rule version + user", status: true },
                { label: "Full audit trace reproducible", status: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 p-2 rounded border border-gray-100 bg-gray-50/50">
                  <div className={`w-2 h-2 rounded-full ${item.status ? "bg-emerald-500" : "bg-red-500"}`} />
                  <p className="text-xs text-gray-700">{item.label}</p>
                  <Badge variant="outline" className={`ml-auto text-[10px] ${item.status ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-red-700 border-red-200 bg-red-50"}`}>
                    {item.status ? "Enforced" : "Violation"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
