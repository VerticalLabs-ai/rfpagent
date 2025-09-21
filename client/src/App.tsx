import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import RFPDiscovery from "@/pages/rfp-discovery";
import RFPDetails from "@/pages/rfp-details";
import RFPs from "@/pages/rfps";
import ScanHistory from "@/pages/scan-history";
import Proposals from "@/pages/proposals";
import Compliance from "@/pages/compliance";
import Submissions from "@/pages/submissions";
import PortalSettings from "@/pages/portal-settings";
import Analytics from "@/pages/analytics";
import CompanyProfiles from "@/pages/company-profiles";
import AIChat from "@/pages/ai-chat";
import WorkflowManagement from "@/pages/workflow-management";
import AgentMonitoring from "@/pages/agent-monitoring";
import SystemSettings from "@/pages/system-settings";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

function Router() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/discovery" component={RFPDiscovery} />
            <Route path="/rfps" component={RFPs} />
            <Route path="/rfps/:id" component={RFPDetails} />
            <Route path="/scan-history" component={ScanHistory} />
            <Route path="/portals" component={PortalSettings} />
            <Route path="/proposals" component={Proposals} />
            <Route path="/compliance" component={Compliance} />
            <Route path="/submissions" component={Submissions} />
            <Route path="/company-profiles" component={CompanyProfiles} />
            <Route path="/portal-settings" component={PortalSettings} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/ai-chat" component={AIChat} />
            <Route path="/workflow-management" component={WorkflowManagement} />
            <Route path="/agent-monitoring" component={AgentMonitoring} />
            <Route path="/system-settings" component={SystemSettings} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
