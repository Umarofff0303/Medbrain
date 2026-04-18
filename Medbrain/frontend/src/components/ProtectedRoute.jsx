import { Spin } from 'antd';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

function resolveHomePath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  return '/student';
}

export function ProtectedRoute({ allowedRole, allowedRoles }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const resolvedAllowedRoles = Array.isArray(allowedRoles)
    ? allowedRoles
    : allowedRole
      ? [allowedRole]
      : [];

  if (isLoading) {
    return (
      <div className="center-screen">
        <Spin size="large" tip="Yuklanmoqda..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (resolvedAllowedRoles.length > 0 && !resolvedAllowedRoles.includes(role)) {
    return <Navigate to={resolveHomePath(role)} replace />;
  }

  return <Outlet />;
}
