import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import QuickActions from "@/pages/quick-actions";
import MissionControl from "@/pages/MissionControl";
import Connections from "@/pages/connections";

import PromoCodeConfigs from "@/pages/promo-code-agent";
import ReturnsAgent from "@/pages/returns-agent";
import ApprovalQueue from "@/pages/approval-queue";
import AIAssistant from "@/pages/escalation-queue";
import AITraining from "@/pages/ai-training";
import AITrainingNew from "@/pages/ai-training-new";
import { AIPerformancePage } from "@/pages/ai-performance";
import SubscriptionAgent from "@/pages/subscription-agent";
import WismoAgent from "@/pages/wismo-agent";
import ProductAgent from "@/pages/product-agent";
import ActivityLog from "@/pages/activity-log";
import AutomatedCampaigns from "@/pages/AutomatedCampaigns";
import OrderCancellationPage from "@/pages/OrderCancellationPage";
import AddressChangePage from "@/pages/AddressChangePage";
import WidgetDemo from "@/pages/WidgetDemo";
import Widget from "@/pages/Widget";
import WismoWidget from "@/pages/WismoWidget";

import Admin from "@/pages/admin";
import SentimentTest from "@/pages/SentimentTest";
import AdminRouteGuard from "@/components/auth/admin-route-guard";
import AuthRouteGuard from "@/components/auth/auth-route-guard";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import AccountSettings from "@/pages/account-settings";
import StripeInspiredHomepage from "@/pages/stripe-inspired";

import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import PlanSelection from "@/pages/plan-selection";
import Pricing from "@/pages/pricing";
import Subscribe from "@/pages/subscribe";
import SupportPage from "@/pages/support";
import DemoPaymentPage from "@/pages/demo-payment";

function Router() {
  return (
    <Switch>
      {/* Protected application routes - require authentication */}
      <Route path="/dashboard">
        <AuthRouteGuard>
          <MissionControl />
        </AuthRouteGuard>
      </Route>
      <Route path="/demo-payment">
        <AuthRouteGuard>
          <DemoPaymentPage />
        </AuthRouteGuard>
      </Route>
      <Route path="/quick-actions">
        <AuthRouteGuard>
          <QuickActions />
        </AuthRouteGuard>
      </Route>

      <Route path="/promo-code-agent">
        <AuthRouteGuard>
          <PromoCodeConfigs />
        </AuthRouteGuard>
      </Route>
      <Route path="/returns-agent">
        <AuthRouteGuard>
          <ReturnsAgent />
        </AuthRouteGuard>
      </Route>
      <Route path="/approval-queue">
        <AuthRouteGuard>
          <ApprovalQueue />
        </AuthRouteGuard>
      </Route>
      <Route path="/ai-assistant">
        <AuthRouteGuard>
          <AIAssistant />
        </AuthRouteGuard>
      </Route>
      <Route path="/ai-training">
        <AuthRouteGuard>
          <AITrainingNew />
        </AuthRouteGuard>
      </Route>
      <Route path="/ai-training-old">
        <AuthRouteGuard>
          <AITraining />
        </AuthRouteGuard>
      </Route>
      <Route path="/ai-performance">
        <AuthRouteGuard>
          <AIPerformancePage />
        </AuthRouteGuard>
      </Route>
      <Route path="/subscription-agent">
        <AuthRouteGuard>
          <SubscriptionAgent />
        </AuthRouteGuard>
      </Route>
      <Route path="/wismo-agent">
        <AuthRouteGuard>
          <WismoAgent />
        </AuthRouteGuard>
      </Route>
      <Route path="/product-agent">
        <AuthRouteGuard>
          <ProductAgent />
        </AuthRouteGuard>
      </Route>
      <Route path="/activity-log">
        <AuthRouteGuard>
          <ActivityLog />
        </AuthRouteGuard>
      </Route>
      <Route path="/automated-campaigns">
        <AuthRouteGuard>
          <AutomatedCampaigns />
        </AuthRouteGuard>
      </Route>
      <Route path="/order-cancellations">
        <AuthRouteGuard>
          <OrderCancellationPage />
        </AuthRouteGuard>
      </Route>
      <Route path="/address-change">
        <AuthRouteGuard>
          <AddressChangePage />
        </AuthRouteGuard>
      </Route>
      <Route path="/wismo-widget">
        <AuthRouteGuard>
          <WismoWidget />
        </AuthRouteGuard>
      </Route>
      {/* Redirect old simple route to main order cancellations */}
      <Route path="/order-cancellations-simple">
        <Redirect to="/order-cancellations" />
      </Route>
      <Route path="/connections">
        <AuthRouteGuard>
          <Connections />
        </AuthRouteGuard>
      </Route>
      <Route path="/account-settings">
        <AuthRouteGuard>
          <AccountSettings />
        </AuthRouteGuard>
      </Route>
      <Route path="/support" component={SupportPage} />

      {/* Admin routes - require authentication + admin privileges */}
      <Route path="/admin">
        <AuthRouteGuard>
          <AdminRouteGuard>
            <Admin />
          </AdminRouteGuard>
        </AuthRouteGuard>
      </Route>
      <Route path="/admin/sentiment-test">
        <AuthRouteGuard>
          <AdminRouteGuard>
            <SentimentTest />
          </AdminRouteGuard>
        </AuthRouteGuard>
      </Route>


      {/* Public routes - no authentication required */}
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/plan-selection" component={PlanSelection} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/subscribe" component={Subscribe} />

      <Route path="/widget-demo" component={WidgetDemo} />
      <Route path="/widget" component={Widget} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/v2">
        <Redirect to="/" />
      </Route>
      <Route path="/" component={StripeInspiredHomepage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;