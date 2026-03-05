import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

// Public pages
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";

// Auth pages
import ChangePasswordPage from "./pages/auth/ChangePasswordPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";

// Customer pages
import BookingsPage from "./pages/customer/BookingsPage";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import MySubscriptionsPage from "./pages/customer/MySubscriptionsPage";
import NotificationSettingsPage from "./pages/customer/NotificationSettingsPage";
import PaymentsPage from "./pages/customer/PaymentsPage";
import PreferencesPage from "./pages/customer/PreferencesPage";
import ProfilePage from "./pages/customer/ProfilePage";
import ServiceAreaDemo from "./pages/customer/ServiceAreaDemo";
import ServiceRouter from "./pages/customer/ServiceRouter";
import ServicesPage from "./pages/customer/ServicesPage";
import SubscriptionBookingPage from "./pages/customer/SubscriptionBookingPage";

// Worker pages
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import WorkerEarnings from "./pages/worker/WorkerEarnings";
import WorkerLeaves from "./pages/worker/WorkerLeaves";
import WorkerProfile from "./pages/worker/WorkerProfile";
import WorkerTasks from "./pages/worker/WorkerTasks";

// Admin pages
import AdminBookings from "./pages/admin/AdminBookings";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLeaves from "./pages/admin/AdminLeaves";
import AdminLocations from "./pages/admin/AdminLocations";
import AdminServices from "./pages/admin/AdminServices";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminWorkers from "./pages/admin/AdminWorkers";
import AdminWorkerSchedule from "./pages/admin/AdminWorkerSchedule";
import AdminWorkforce from "./pages/admin/AdminWorkforce";

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

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* Customer */}
          <Route path="/customer/dashboard" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/customer/services" element={<ProtectedRoute allowedRoles={['customer']}><ServicesPage /></ProtectedRoute>} />
          <Route path="/customer/book/:id" element={<ProtectedRoute allowedRoles={['customer']}><ServiceRouter /></ProtectedRoute>} />
          <Route path="/customer/subscribe/:id" element={<ProtectedRoute allowedRoles={['customer']}><SubscriptionBookingPage /></ProtectedRoute>} />
          <Route path="/customer/bookings" element={<ProtectedRoute allowedRoles={['customer']}><BookingsPage /></ProtectedRoute>} />
          <Route path="/customer/subscriptions" element={<ProtectedRoute allowedRoles={['customer']}><MySubscriptionsPage /></ProtectedRoute>} />
          <Route path="/customer/payments" element={<ProtectedRoute allowedRoles={['customer']}><PaymentsPage /></ProtectedRoute>} />
          <Route path="/customer/preferences" element={<ProtectedRoute allowedRoles={['customer']}><PreferencesPage /></ProtectedRoute>} />
          <Route path="/customer/notifications" element={<ProtectedRoute allowedRoles={['customer']}><NotificationSettingsPage /></ProtectedRoute>} />
          <Route path="/customer/profile" element={<ProtectedRoute allowedRoles={['customer']}><ProfilePage /></ProtectedRoute>} />
          <Route path="/customer/service-areas" element={<ProtectedRoute allowedRoles={['customer']}><ServiceAreaDemo /></ProtectedRoute>} />

          {/* Worker */}
          <Route path="/worker/dashboard" element={<ProtectedRoute allowedRoles={['worker']}><WorkerDashboard /></ProtectedRoute>} />
          <Route path="/worker/tasks" element={<ProtectedRoute allowedRoles={['worker']}><WorkerTasks /></ProtectedRoute>} />
          <Route path="/worker/earnings" element={<ProtectedRoute allowedRoles={['worker']}><WorkerEarnings /></ProtectedRoute>} />
          <Route path="/worker/leaves" element={<ProtectedRoute allowedRoles={['worker']}><WorkerLeaves /></ProtectedRoute>} />
          <Route path="/worker/profile" element={<ProtectedRoute allowedRoles={['worker']}><WorkerProfile /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminBookings /></ProtectedRoute>} />
          <Route path="/admin/workforce" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminWorkforce /></ProtectedRoute>} />
          <Route path="/admin/worker-schedule" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminWorkerSchedule /></ProtectedRoute>} />
          <Route path="/admin/leaves" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminLeaves /></ProtectedRoute>} />
          <Route path="/admin/services" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminServices /></ProtectedRoute>} />
          <Route path="/admin/workers" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminWorkers /></ProtectedRoute>} />
          <Route path="/admin/locations" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminLocations /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminSettings /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
