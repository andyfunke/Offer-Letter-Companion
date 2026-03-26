import { useAuth } from '@/hooks/use-auth';
import { AdminLayout } from './AdminLayout';
import { Shield, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';

export default function AdminDashboard() {
  const { user, hasRole } = useAuth();

  const cards = [
    hasRole('system_admin') && {
      href: '/admin/users',
      icon: Users,
      title: 'User Management',
      desc: 'Create, edit, and deactivate user accounts and manage roles.',
      color: 'text-blue-600 bg-blue-50',
    },
    hasRole('hr_admin') && {
      href: '/admin/issues',
      icon: AlertCircle,
      title: 'Issue Reports',
      desc: 'Review telemetry issues reported by HR staff.',
      color: 'text-amber-600 bg-amber-50',
    },
    hasRole('system_admin') && {
      href: '/admin/security-spec',
      icon: Shield,
      title: 'Security Spec',
      desc: 'Internal technical security specification.',
      color: 'text-emerald-600 bg-emerald-50',
    },
  ].filter(Boolean) as Array<{ href: string; icon: React.ElementType; title: string; desc: string; color: string }>;

  return (
    <AdminLayout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-serif font-bold mb-1">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Welcome back, {user?.username}. You are signed in as <strong>{user?.role}</strong>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map(({ href, icon: Icon, title, desc, color }) => (
            <Link key={href} href={href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-2`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-start gap-3">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
          <div>
            <strong>Security active.</strong> All actions in this admin panel are logged in the audit trail.
            Passwords are hashed with bcrypt (cost factor 12). Sessions expire after 8 hours.
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
