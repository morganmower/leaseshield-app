import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  FileText,
  Bell,
  UserPlus,
  Search,
  ArrowRight,
} from "lucide-react";

export default function DashboardPreview() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold tracking-[0.18em] text-ink-500 dark:text-slate-400">
              DASHBOARD PREVIEW
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 dark:text-white md:text-4xl">
              Your Protection Center
            </h1>
            <p className="mt-3 max-w-2xl text-base text-ink-700 dark:text-slate-300">
              Everything in one place: report explanations, templates, compliance alerts, and
              applications — organized for fast decisions.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="gap-2 border-slate-300 dark:border-slate-700" asChild>
              <a href="/screening/explain">
                <Search className="h-4 w-4" />
                Explain a Report
              </a>
            </Button>
            <Button className="gap-2 bg-brand-500 hover:bg-brand-600" asChild>
              <a href="/signup">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit border border-slate-200 bg-panel-50 dark:bg-slate-900 dark:border-slate-800 p-4">
            <div className="text-sm font-semibold text-ink-900 dark:text-white">LeaseShield</div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="rounded-lg bg-brand-50 dark:bg-brand-800/20 px-3 py-2 font-medium text-brand-700 dark:text-brand-300">
                Screening Decoder
              </div>
              <div className="rounded-lg px-3 py-2 text-ink-700 dark:text-slate-300 hover:bg-panel-100 dark:hover:bg-slate-800">
                Templates
              </div>
              <div className="rounded-lg px-3 py-2 text-ink-700 dark:text-slate-300 hover:bg-panel-100 dark:hover:bg-slate-800">
                Compliance Alerts
              </div>
              <div className="rounded-lg px-3 py-2 text-ink-700 dark:text-slate-300 hover:bg-panel-100 dark:hover:bg-slate-800">
                Notices & Letters
              </div>
              <div className="rounded-lg px-3 py-2 text-ink-700 dark:text-slate-300 hover:bg-panel-100 dark:hover:bg-slate-800">
                Rent Ledger
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-panel-50 dark:bg-slate-900 p-3 text-xs text-ink-700 dark:text-slate-300">
              Tip: Most landlords start by explaining a screening report — then generate the right
              state forms.
            </div>
          </Card>

          <div className="grid gap-6">
            <div className="grid gap-6 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35 }}
              >
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 h-full">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-brand-500" />
                        <h3 className="text-lg font-semibold text-ink-900 dark:text-white">
                          Decode Screening Reports
                        </h3>
                      </div>
                      <p className="mt-2 text-sm text-ink-700 dark:text-slate-300">
                        Plain-English explanations + risk flags + compliant next steps.
                      </p>
                    </div>
                    <Badge className="bg-brand-50 dark:bg-brand-800/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-800/30">
                      Most used
                    </Badge>
                  </div>
                  <a href="#" className="mt-4 inline-block text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">
                    Open →
                  </a>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.05 }}
              >
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 h-full">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-brand-500" />
                        <h3 className="text-lg font-semibold text-ink-900 dark:text-white">
                          State-Specific Templates
                        </h3>
                      </div>
                      <p className="mt-2 text-sm text-ink-700 dark:text-slate-300">
                        Leases, notices, checklists — kept current by state.
                      </p>
                    </div>
                    <Badge className="bg-panel-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:bg-panel-100 dark:hover:bg-slate-700">
                      238+ docs
                    </Badge>
                  </div>
                  <a href="#" className="mt-4 inline-block text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">
                    Open →
                  </a>
                </Card>
              </motion.div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-brand-500" />
                      <h3 className="text-lg font-semibold text-ink-900 dark:text-white">Compliance Alerts</h3>
                    </div>
                    <p className="mt-2 text-sm text-ink-700 dark:text-slate-300">
                      Monthly "impact-only" updates + what to do next.
                    </p>
                  </div>
                  <Badge className="bg-panel-100 dark:bg-slate-800 text-ink-700 dark:text-slate-300 hover:bg-panel-100 dark:hover:bg-slate-700">
                    Monthly
                  </Badge>
                </div>
                <a href="#" className="mt-4 inline-block text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">
                  Open →
                </a>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-brand-500" />
                      <h3 className="text-lg font-semibold text-ink-900 dark:text-white">
                        Application + Screening
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-ink-700 dark:text-slate-300">
                      Send an application link → run screening via Western Verify.
                    </p>
                  </div>
                  <Badge className="bg-brand-50 dark:bg-brand-800/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-800/30">
                    Integrated
                  </Badge>
                </div>
                <a href="#" className="mt-4 inline-block text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">
                  Open →
                </a>
              </Card>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-panel-50 dark:bg-slate-900 p-6">
              <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <div className="text-sm font-semibold text-ink-900 dark:text-white">
                    Ready to use the real thing?
                  </div>
                  <div className="mt-1 text-sm text-ink-700 dark:text-slate-300">
                    Start a 7-day trial. No credit card required.
                  </div>
                </div>
                <Button className="gap-2 bg-brand-500 hover:bg-brand-600" asChild>
                  <a href="/signup">
                    Start Free Trial <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="text-xs text-ink-500 dark:text-slate-400">
              Preview page only (no account required). You can later gate this route behind auth.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
