import { authAPI } from '@/lib/api';
import { useEffect, useState } from 'react';

export const useAdminRole = () => {
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin');
  const [name, setName] = useState('Admin');

  useEffect(() => {
    authAPI.getProfile().then(res => {
      const user = res?.user || res;
      if (user?.role) setRole(user.role);
      if (user?.name) setName(user.name);
    }).catch(() => {});
  }, []);

  return { role, name, isSuperAdmin: role === 'super_admin' };
};
