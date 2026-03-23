import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

// Public pages
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";

// Auth pages
import ChangePasswordPage from "./pages/auth/ChangePasswordPage";
import CustomerSignUp from "./pages/auth/CustomerSignUp";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import LoginPage from "./pages/auth/LoginPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import WorkerSignUp from "./pages/auth/WorkerSignUp";

// Customer pages
import BookingsPage from "./pages/customer/BookingsPage";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import DeepCleaningCategoryPage from "./pages/customer/DeepCleaningCategoryPage";
import DeepCleaningLandingPage from "./pages/customer/DeepCleaningLandingPage";
import DeepCleaningPage from "./pages/customer/DeepCleaningPage";
import DeepCleaningQuotePage from "./pages/customer/DeepCleaningQuotePage";
import HelpPage from "./pages/customer/HelpPage";
import MyQuotesPage from "./pages/customer/MyQuotesPage";
import MySubscriptionsPage from "./pages/customer/MySubscriptionsPage";
import NotificationSettingsPage from "./pages/customer/NotificationSettingsPage";
import NotificationsPage from "./pages/customer/NotificationsPage";
import PaymentsPage from "./pages/customer/PaymentsPage";
import PreferencesPage from "./pages/customer/PreferencesPage";
import ProfilePage from "./pages/customer/ProfilePage";
import ServiceAreaDemo from "./pages/customer/ServiceAreaDemo";
import ServiceRouter from "./pages/customer/ServiceRouter";
import DeepCleaningServicePage from "./pages/customer/services/DeepCleaningServicePage";
import InstaServicePage from "./pages/customer/services/InstaServicePage";
import SpotCleanPage from "./pages/customer/services/SpotCleanPage";
import SubscriptionServicePage from "./pages/customer/services/SubscriptionServicePage";
import ServicesPage from "./pages/customer/ServicesPage";
import SubscriptionBookingPage from "./pages/customer/SubscriptionBookingPage";
import InstaMaidCapabilities from "./pages/InstaMaidCapabilities";

// Worker pages
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import WorkerEarnings from "./pages/worker/WorkerEarnings";
import WorkerLeaves from "./pages/worker/WorkerLeaves";
import WorkerProfile from "./pages/worker/WorkerProfile";
import WorkerSalaryRequest from "./pages/worker/WorkerSalaryRequest";
import WorkerTasks from "./pages/worker/WorkerTasks";

// Admin pages
import AdminBookings from "./pages/admin/AdminBookings";
import AdminCustomerDetails from "./pages/admin/AdminCustomerDetails";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDashboardPreferences from "./pages/admin/AdminDashboardPreferences";
import AdminDeepCleaningConfig from "./pages/admin/AdminDeepCleaningConfig";
import AdminExpenses from "./pages/admin/AdminExpenses";
import AdminHelpMessages from "./pages/admin/AdminHelpMessages";
import AdminLeaves from "./pages/admin/AdminLeaves";
import AdminLocations from "./pages/admin/AdminLocations";
import AdminQuotes from "./pages/admin/AdminQuotes";
import AdminSalarySettlements from "./pages/admin/AdminSalarySettlements";
import AdminServiceAreas from "./pages/admin/AdminServiceAreas";
import AdminServices from "./pages/admin/AdminServices";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminSOS from "./pages/admin/AdminSOS";
import AdminSubscriptionSections from "./pages/admin/AdminSubscriptionSections";
import AdminWorkerRequests from "./pages/admin/AdminWorkerRequests";
import AdminWorkers from "./pages/admin/AdminWorkers";
import AdminWorkerSchedule from "./pages/admin/AdminWorkerSchedule";
import AdminWorkforce from "./pages/admin/AdminWorkforce";
import BusinessExpenses from "./pages/shared/BusinessExpenses";

// Super Admin pages
import SuperAdminBookings from "./pages/superadmin/SuperAdminBookings";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminDeepCleaningConfig from "./pages/superadmin/SuperAdminDeepCleaningConfig";
import SuperAdminHeatmap from "./pages/superadmin/SuperAdminHeatmap";
import SuperAdminHelpMessages from "./pages/superadmin/SuperAdminHelpMessages";
import SuperAdminLeaves from "./pages/superadmin/SuperAdminLeaves";
import SuperAdminLocations from "./pages/superadmin/SuperAdminLocations";
import SuperAdminQuotes from "./pages/superadmin/SuperAdminQuotes";
import SuperAdminSalarySettlements from "./pages/superadmin/SuperAdminSalarySettlements";
import SuperAdminServiceAreas from "./pages/superadmin/SuperAdminServiceAreas";
import SuperAdminServices from "./pages/superadmin/SuperAdminServices";
import SuperAdminSettings from "./pages/superadmin/SuperAdminSettings";
import SuperAdminSOS from "./pages/superadmin/SuperAdminSOS";
import SuperAdminWorkerRequests from "./pages/superadmin/SuperAdminWorkerRequests";
import SuperAdminWorkers from "./pages/superadmin/SuperAdminWorkers";
import SuperAdminWorkerSchedule from "./pages/superadmin/SuperAdminWorkerSchedule";
import SuperAdminWorkforce from "./pages/superadmin/SuperAdminWorkforce";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/insta-maid-capabilities" element={<InstaMaidCapabilities />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<Navigate to="/register/customer" replace />} />
          <Route path="/register/customer" element={<CustomerSignUp />} />
          <Route path="/register/worker" element={<WorkerSignUp />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/deep-cleaning-quote" element={<DeepCleaningQuotePage />} />

          {/* Customer */}
          <Route path="/customer/dashboard" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/customer/services" element={<ProtectedRoute allowedRoles={['customer']}><ServicesPage /></ProtectedRoute>} />
          <Route path="/customer/services/insta" element={<ProtectedRoute allowedRoles={['customer']}><InstaServicePage /></ProtectedRoute>} />
          <Route path="/customer/services/subscription" element={<ProtectedRoute allowedRoles={['customer']}><SubscriptionServicePage /></ProtectedRoute>} />
          <Route path="/customer/services/deep-cleaning" element={<ProtectedRoute allowedRoles={['customer']}><DeepCleaningServicePage /></ProtectedRoute>} />
          <Route path="/customer/services/spot-clean" element={<ProtectedRoute allowedRoles={['customer']}><SpotCleanPage /></ProtectedRoute>} />
          <Route path="/customer/services/intense-washroom-cleaning" element={<ProtectedRoute allowedRoles={['customer']}><SpotCleanPage /></ProtectedRoute>} />
          <Route path="/customer/services/kitchen-deep-clean" element={<ProtectedRoute allowedRoles={['customer']}><SpotCleanPage /></ProtectedRoute>} />
          <Route path="/customer/services/window-deep-cleaning" element={<ProtectedRoute allowedRoles={['customer']}><SpotCleanPage /></ProtectedRoute>} />
          <Route path="/customer/deep-cleaning" element={<ProtectedRoute allowedRoles={['customer']}><DeepCleaningLandingPage /></ProtectedRoute>} />
          <Route path="/customer/deep-cleaning/:categoryId" element={<ProtectedRoute allowedRoles={['customer']}><DeepCleaningCategoryPage /></ProtectedRoute>} />
          <Route path="/customer/deep-cleaning/customize" element={<ProtectedRoute allowedRoles={['customer']}><DeepCleaningPage /></ProtectedRoute>} />
          <Route path="/customer/book/:id" element={<ProtectedRoute allowedRoles={['customer']}><ServiceRouter /></ProtectedRoute>} />
          <Route path="/customer/subscribe/:id" element={<ProtectedRoute allowedRoles={['customer']}><SubscriptionBookingPage /></ProtectedRoute>} />
          <Route path="/customer/bookings" element={<ProtectedRoute allowedRoles={['customer']}><BookingsPage /></ProtectedRoute>} />
          <Route path="/customer/my-quotes" element={<ProtectedRoute allowedRoles={['customer']}><MyQuotesPage /></ProtectedRoute>} />
          <Route path="/customer/subscriptions" element={<ProtectedRoute allowedRoles={['customer']}><MySubscriptionsPage /></ProtectedRoute>} />
          <Route path="/customer/payments" element={<ProtectedRoute allowedRoles={['customer']}><PaymentsPage /></ProtectedRoute>} />
          <Route path="/customer/preferences" element={<ProtectedRoute allowedRoles={['customer']}><PreferencesPage /></ProtectedRoute>} />
          <Route path="/customer/notifications" element={<ProtectedRoute allowedRoles={['customer']}><NotificationsPage userType="customer" /></ProtectedRoute>} />
          <Route path="/customer/notification-settings" element={<ProtectedRoute allowedRoles={['customer']}><NotificationSettingsPage /></ProtectedRoute>} />
          <Route path="/customer/profile" element={<ProtectedRoute allowedRoles={['customer']}><ProfilePage /></ProtectedRoute>} />
          <Route path="/customer/help" element={<ProtectedRoute allowedRoles={['customer']}><HelpPage userType="customer" /></ProtectedRoute>} />
          <Route path="/customer/service-areas" element={<ProtectedRoute allowedRoles={['customer']}><ServiceAreaDemo /></ProtectedRoute>} />

          {/* Worker */}
          <Route path="/worker/dashboard" element={<ProtectedRoute allowedRoles={['worker']}><WorkerDashboard /></ProtectedRoute>} />
          <Route path="/worker/tasks" element={<ProtectedRoute allowedRoles={['worker']}><WorkerTasks /></ProtectedRoute>} />
          <Route path="/worker/earnings" element={<ProtectedRoute allowedRoles={['worker']}><WorkerEarnings /></ProtectedRoute>} />
          <Route path="/worker/leaves" element={<ProtectedRoute allowedRoles={['worker']}><WorkerLeaves /></ProtectedRoute>} />
          <Route path="/worker/salary" element={<ProtectedRoute allowedRoles={['worker']}><WorkerSalaryRequest /></ProtectedRoute>} />
          <Route path="/worker/profile" element={<ProtectedRoute allowedRoles={['worker']}><WorkerProfile /></ProtectedRoute>} />
          <Route path="/worker/notifications" element={<ProtectedRoute allowedRoles={['worker']}><NotificationsPage userType="worker" /></ProtectedRoute>} />
          <Route path="/worker/help" element={<ProtectedRoute allowedRoles={['worker']}><HelpPage userType="worker" /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminBookings /></ProtectedRoute>} />
          <Route path="/admin/customers" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminCustomers /></ProtectedRoute>} />
          <Route path="/admin/customers/:customerId" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminCustomerDetails /></ProtectedRoute>} />
          <Route path="/admin/expenses" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminExpenses /></ProtectedRoute>} />
          <Route path="/admin/dashboard-preferences" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboardPreferences /></ProtectedRoute>} />
          <Route path="/admin/subscription-sections" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminSubscriptionSections /></ProtectedRoute>} />
          <Route path="/admin/workforce" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminWorkforce /></ProtectedRoute>} />
          <Route path="/admin/worker-schedule" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminWorkerSchedule /></ProtectedRoute>} />
          <Route path="/admin/worker-requests" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminWorkerRequests /></ProtectedRoute>} />
          <Route path="/admin/leaves" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminLeaves /></ProtectedRoute>} />
          <Route path="/admin/services" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminServices /></ProtectedRoute>} />
          <Route path="/admin/deep-cleaning-config" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDeepCleaningConfig /></ProtectedRoute>} />
          <Route path="/admin/workers" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminWorkers /></ProtectedRoute>} />
          <Route path="/admin/locations" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminLocations /></ProtectedRoute>} />
          <Route path="/admin/service-areas" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminServiceAreas /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminSettings /></ProtectedRoute>} />
          <Route path="/admin/salary-settlements" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminSalarySettlements /></ProtectedRoute>} />
          <Route path="/admin/notifications" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><NotificationsPage /></ProtectedRoute>} />
          <Route path="/admin/help-messages" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminHelpMessages /></ProtectedRoute>} />
          <Route path="/admin/sos" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminSOS /></ProtectedRoute>} />
          <Route path="/admin/quotes" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminQuotes /></ProtectedRoute>} />
          <Route path="/admin/business-expenses" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><BusinessExpenses /></ProtectedRoute>} />

          {/* Super Admin */}
          <Route path="/super-admin/dashboard" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/super-admin/bookings" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminBookings /></ProtectedRoute>} />
          <Route path="/super-admin/workers" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminWorkers /></ProtectedRoute>} />
          <Route path="/super-admin/worker-requests" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminWorkerRequests /></ProtectedRoute>} />
          <Route path="/super-admin/sos" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminSOS /></ProtectedRoute>} />
          <Route path="/super-admin/leaves" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminLeaves /></ProtectedRoute>} />
          <Route path="/super-admin/worker-schedule" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminWorkerSchedule /></ProtectedRoute>} />
          <Route path="/super-admin/workforce" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminWorkforce /></ProtectedRoute>} />
          <Route path="/super-admin/salary-settlements" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminSalarySettlements /></ProtectedRoute>} />
          <Route path="/super-admin/quotes" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminQuotes /></ProtectedRoute>} />
          <Route path="/super-admin/help-messages" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminHelpMessages /></ProtectedRoute>} />
          <Route path="/super-admin/locations" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminLocations /></ProtectedRoute>} />
          <Route path="/super-admin/demand-requests" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminServiceAreas /></ProtectedRoute>} />
          <Route path="/super-admin/service-areas" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminServiceAreas /></ProtectedRoute>} />
          <Route path="/super-admin/services" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminServices /></ProtectedRoute>} />
          <Route path="/super-admin/settings" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminSettings /></ProtectedRoute>} />
          <Route path="/super-admin/notifications" element={<ProtectedRoute allowedRoles={['super_admin']}><NotificationsPage /></ProtectedRoute>} />
          <Route path="/super-admin/deep-cleaning-config" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDeepCleaningConfig /></ProtectedRoute>} />
          <Route path="/super-admin/heatmap" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminHeatmap /></ProtectedRoute>} />
          <Route path="/super-admin/business-expenses" element={<ProtectedRoute allowedRoles={['super_admin']}><BusinessExpenses /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
