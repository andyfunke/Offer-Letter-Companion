import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import SecurityPolicy from "@/pages/SecurityPolicy";
import AdminSecuritySpec from "@/pages/AdminSecuritySpec";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminIssues from "@/pages/admin/AdminIssues";
import AdminIssueDetail from "@/pages/admin/AdminIssueDetail";
import IssuePreview from "@/pages/admin/IssuePreview";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function RequireAuth({ children, minRole }: {
  children: React.ReactNode;
  minRole?: "recruiter" | "hr_admin" | "system_admin";
}) {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  if (!user) return <Redirect to="/login" />;
  if (minRole && !hasRole(minRole)) return <div className="min-h-screen flex items-center justify-center text-destructive text-sm">Access denied — insufficient permissions.</div>;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/security" component={SecurityPolicy} />

      <Route path="/">
        <RequireAuth minRole="recruiter"><Home /></RequireAuth>
      </Route>

      <Route path="/admin">
        <RequireAuth minRole="hr_admin"><AdminDashboard /></RequireAuth>
      </Route>
      <Route path="/admin/users">
        <RequireAuth minRole="system_admin"><AdminUsers /></RequireAuth>
      </Route>
      <Route path="/admin/issues/:id/preview">
        {(params) => <RequireAuth minRole="hr_admin"><IssuePreview /></RequireAuth>}
      </Route>
      <Route path="/admin/issues/:id">
        {(params) => <RequireAuth minRole="hr_admin"><AdminIssueDetail /></RequireAuth>}
      </Route>
      <Route path="/admin/issues">
        <RequireAuth minRole="hr_admin"><AdminIssues /></RequireAuth>
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
