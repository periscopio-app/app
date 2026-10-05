import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function TenantDashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
