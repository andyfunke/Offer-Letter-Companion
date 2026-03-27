import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Shield, Users, AlertCircle, LayoutDashboard, ChevronRight, LogOut, Calendar, FileText, UserCheck } from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'General',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, minRole: 'admin' as const },
      { href: '/admin/issues', label: 'Issues', icon: AlertCircle, minRole: 'admin' as const },
    ],
  },
  {
    label: 'Offer Config',
    items: [
      { href: '/admin/pto', label: 'PTO Options', icon: Calendar, minRole: 'admin' as const },
      { href: '/admin/letterhead', label: 'Letterhead', icon: FileText, minRole: 'admin' as const },
      { href: '/admin/hr-contacts', label: 'HR Contacts', icon: UserCheck, minRole: 'admin' as const },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/users', label: 'User Accounts', icon: Users, minRole: 'admin' as const },
      { href: '/admin/security-spec', label: 'Security Spec', icon: Shield, minRole: 'admin' as const },
    ],
  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-56 bg-card border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Admin Panel</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{user?.username} · {user?.role}</p>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(n => hasRole(n.minRole));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map(({ href, label, icon: Icon }) => {
                    const active = location === href || (href !== '/admin' && location.startsWith(href));
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" /> {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t p-3 space-y-1">
          <Link href="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">
            ← Back to app
          </Link>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive px-3 py-1.5 w-full"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb */}
        <div className="h-12 border-b bg-card/50 flex items-center px-6 gap-2 text-sm text-muted-foreground shrink-0">
          <span>Admin</span>
          {location !== '/admin' && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground capitalize">
                {location.replace('/admin/', '').split('/')[0].replace(/-/g, ' ')}
              </span>
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
