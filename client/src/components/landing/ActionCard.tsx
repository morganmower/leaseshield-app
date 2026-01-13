import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  href: string;
  tone?: "primary" | "secondary";
}

export function ActionCard({ icon, title, desc, cta, href, tone = "primary" }: ActionCardProps) {
  const primary = tone === "primary";

  return (
    <Card
      className={[
        "border p-8 shadow-soft h-full flex flex-col",
        primary
          ? "border-brand-200 bg-brand-50 dark:border-brand-700/40 dark:bg-slate-900"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
      ].join(" ")}
    >
      <div className="flex items-start gap-4 flex-1">
        <div className="rounded-xl bg-panel-50 p-3 dark:bg-slate-900 flex-shrink-0">{icon}</div>
        <div className="flex-1 flex flex-col">
          <h3 className="text-xl font-semibold text-ink-900 dark:text-white">{title}</h3>
          <p className="mt-2 text-sm text-ink-700 dark:text-slate-300 flex-1">{desc}</p>
        </div>
      </div>
      <Button
        asChild
        className={[
          "mt-6 gap-2",
          primary
            ? "bg-brand-500 hover:bg-brand-600 text-white"
            : "bg-white border border-slate-300 text-ink-900 hover:bg-panel-50 dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:hover:bg-slate-900",
        ].join(" ")}
      >
        <a href={href}>
          {cta} <ArrowRight className="h-4 w-4" />
        </a>
      </Button>
    </Card>
  );
}
