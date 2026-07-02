import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import { getAdminData } from '@/lib/admin-data';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

// Always render fresh — this is an internal ops view, never cache it.
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/');

  const { metrics, users } = await getAdminData();
  return <AdminDashboard metrics={metrics} users={users} adminEmail={admin.email ?? ''} />;
}
