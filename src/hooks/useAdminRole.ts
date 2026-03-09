import { authAPI } from '@/lib/api';
import { useEffect, useState } from 'react';

export const useAdminRole = () => {
  // Read from localStorage immediately so sidebar renders with correct role on first paint
  const getInitialRole = (): 'admin' | 'super_admin' => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user?.role === 'super_admin') return 'super_admin';
      }
    } catch {}
    return 'admin';
  };

  const getInitialName = (): string => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user?.name) return user.name;
      }
    } catch {}
    return 'Admin';
  };

  const [role, setRole] = useState<'admin' | 'super_admin'>(getInitialRole);
  const [name, setName] = useState(getInitialName);

  useEffect(() => {
    authAPI.getProfile().then(res => {
      const user = res?.user || res;
      if (user?.role) {
        setRole(user.role);
        // Keep localStorage in sync
        try {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...stored, role: user.role, name: user.name }));
        } catch {}
      }
      if (user?.name) setName(user.name);
    }).catch(() => {});
  }, []);

  return { role, name, isSuperAdmin: role === 'super_admin' };
};
