import { PageSpinner } from "@/components/ui";

export default function CollegeLoading() {
  return (
    <PageSpinner
      label="Loading college portal…"
      gradient="bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900"
    />
  );
}
