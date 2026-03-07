import { PageSpinner } from "@/components/ui";

export default function EmployerLoading() {
  return (
    <PageSpinner
      label="Loading verification portal…"
      gradient="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900"
    />
  );
}
