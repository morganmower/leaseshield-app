import { Badge } from "@/components/ui/badge";

interface MiniCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tag?: string;
}

export function MiniCard({ icon, title, desc, tag }: MiniCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-panel-50 p-2 dark:bg-slate-900">{icon}</div>
          <div className="text-sm font-semibold text-ink-900 dark:text-white">{title}</div>
        </div>
        {tag ? (
          <Badge className="bg-panel-100 text-ink-700 hover:bg-panel-100 dark:bg-slate-900 dark:text-slate-200">
            {tag}
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-ink-700 dark:text-slate-300">{desc}</p>
    </div>
  );
}
