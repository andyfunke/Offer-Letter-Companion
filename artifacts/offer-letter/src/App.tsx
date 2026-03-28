import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import SetPassword from "@/pages/SetPassword";
import SecurityPolicy from "@/pages/SecurityPolicy";
import AdminSecuritySpec from "@/pages/AdminSecuritySpec";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminIssues from "@/pages/admin/AdminIssues";
import AdminIssueDetail from "@/pages/admin/AdminIssueDetail";
import IssuePreview from "@/pages/admin/IssuePreview";
import AdminPto from "@/pages/admin/AdminPto";
import AdminLetterhead from "@/pages/admin/AdminLetterhead";
import AdminHrProfiles from "@/pages/admin/AdminHrProfiles";
import AdminInteractions from "@/pages/admin/AdminInteractions";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

// ── Requires authenticated user at the given minimum role ─────────────────
function RequireAuth({ children, minRole }: {
  children: React.ReactNode;
  minRole?: "recruiter" | "hr_admin" | "system_admin";
}) {
  const { user, loading, hasRole } = useAuth();
  if (loading) return null; // parent Router already handles the loading state
  if (!user) return <Redirect to="/login" />;
  if (minRole && !hasRole(minRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive text-sm">
        Access denied — insufficient permissions.
      </div>
    );
  }
  return <>{children}</>;
}

// ── Top-level router: entire routing is gated on setup + auth state ────────
function Router() {
  const { loading, needsSetup, user } = useAuth();

  // Full-page spinner while auth state is resolving
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  // ── Phase 1: No users exist — only the setup screen is accessible ─────
  if (needsSetup) {
    return <Setup />;
  }

  // ── Phase 1b: Logged in but must set a password first ─────────────────
  if (user?.mustResetPassword) {
    return <SetPassword />;
  }

  // ── Phase 2: Users exist — normal authenticated routing ───────────────
  return (
    <Switch>
      {/* Public */}
      <Route path="/login" component={Login} />
      <Route path="/security" component={SecurityPolicy} />

      {/* Protected: recruiter+ */}
      <Route path="/">
        <RequireAuth minRole="recruiter"><Home /></RequireAuth>
      </Route>

      {/* Protected: hr_admin+ */}
      <Route path="/admin">
        <RequireAuth minRole="hr_admin"><AdminDashboard /></RequireAuth>
      </Route>
      <Route path="/admin/issues">
        <RequireAuth minRole="hr_admin"><AdminIssues /></RequireAuth>
      </Route>
      <Route path="/admin/issues/:id/preview">
        <RequireAuth minRole="hr_admin"><IssuePreview /></RequireAuth>
      </Route>
      <Route path="/admin/issues/:id">
        <RequireAuth minRole="hr_admin"><AdminIssueDetail /></RequireAuth>
      </Route>

      {/* Protected: system_admin */}
      <Route path="/admin/users">
        <RequireAuth minRole="system_admin"><AdminUsers /></RequireAuth>
      </Route>
      <Route path="/admin/pto">
        <RequireAuth minRole="system_admin"><AdminPto /></RequireAuth>
      </Route>
      <Route path="/admin/letterhead">
        <RequireAuth minRole="system_admin"><AdminLetterhead /></RequireAuth>
      </Route>
      <Route path="/admin/hr-contacts">
        <RequireAuth minRole="system_admin"><AdminHrProfiles /></RequireAuth>
      </Route>
      <Route path="/admin/interactions">
        <RequireAuth minRole="system_admin"><AdminInteractions /></RequireAuth>
      </Route>
      <Route path="/admin/security-spec">
        <RequireAuth minRole="system_admin"><AdminSecuritySpec /></RequireAuth>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
