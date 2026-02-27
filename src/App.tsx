import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

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
import BookServicePage from "./pages/customer/BookServicePage";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import PaymentsPage from "./pages/customer/PaymentsPage";
import PreferencesPage from "./pages/customer/PreferencesPage";
import ProfilePage from "./pages/customer/ProfilePage";
import ServiceAreaDemo from "./pages/customer/ServiceAreaDemo";
import ServicesPage from "./pages/customer/ServicesPage";

// Worker pages
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import WorkerEarnings from "./pages/worker/WorkerEarnings";
import WorkerLeaves from "./pages/worker/WorkerLeaves";
import WorkerProfile from "./pages/worker/WorkerProfile";
import WorkerTasks from "./pages/worker/WorkerTasks";

// Admin pages
import AdminBookings from "./pages/admin/AdminBookings";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLocations from "./pages/admin/AdminLocations";
import AdminServices from "./pages/admin/AdminServices";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminWorkers from "./pages/admin/AdminWorkers";

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
          <Route path="/customer/dashboard" element={<CustomerDashboard />} />
          <Route path="/customer/services" element={<ServicesPage />} />
          <Route path="/customer/book/:id" element={<BookServicePage />} />
          <Route path="/customer/bookings" element={<BookingsPage />} />
          <Route path="/customer/payments" element={<PaymentsPage />} />
          <Route path="/customer/preferences" element={<PreferencesPage />} />
          <Route path="/customer/profile" element={<ProfilePage />} />
          <Route path="/customer/service-areas" element={<ServiceAreaDemo />} />

          {/* Worker */}
          <Route path="/worker/dashboard" element={<WorkerDashboard />} />
          <Route path="/worker/tasks" element={<WorkerTasks />} />
          <Route path="/worker/earnings" element={<WorkerEarnings />} />
          <Route path="/worker/leaves" element={<WorkerLeaves />} />
          <Route path="/worker/profile" element={<WorkerProfile />} />

          {/* Admin */}
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/bookings" element={<AdminBookings />} />
          <Route path="/admin/services" element={<AdminServices />} />
          <Route path="/admin/workers" element={<AdminWorkers />} />
          <Route path="/admin/locations" element={<AdminLocations />} />
          <Route path="/admin/settings" element={<AdminSettings />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
