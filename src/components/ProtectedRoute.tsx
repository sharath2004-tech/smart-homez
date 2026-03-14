import { authAPI } from '@/lib/api';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'customer' | 'worker' | 'admin' | 'super_admin';
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

// Read cached user from localStorage to show content immediately
function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const cached = getCachedUser();
  const token = localStorage.getItem('token');

  // Start with cached user (instant render) — only show spinner when there's no cache at all
  const [user, setUser] = useState<User | null>(cached);
  const [loading, setLoading] = useState(!cached && !!token);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    // Re-validate token in the background; update cache
    authAPI.getProfile()
      .then((response) => {
        const fresh: User = response.user || response;
        setUser(fresh);
        localStorage.setItem('user', JSON.stringify(fresh));
      })
      .catch(() => {
        // Token is invalid — clear and redirect
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Super admin can preview any section of the app
    if (user.role === 'super_admin') {
      return <>{children}</>;
    }
    const dashboardMap: Record<string, string> = {
      customer: '/customer/dashboard',
      worker: '/worker/dashboard',
      admin: '/admin/dashboard',
      super_admin: '/super-admin/dashboard'
    };
    return <Navigate to={dashboardMap[user.role] || '/'} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
