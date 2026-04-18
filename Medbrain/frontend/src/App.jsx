import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/useAuth';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/admin/AdminPage';
import { TestEditorPage } from './pages/admin/TestEditorPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AttemptPage } from './pages/student/AttemptPage';
import { ResultPage } from './pages/student/ResultPage';
import { StudentHomePage } from './pages/student/StudentHomePage';
import { TeacherPage } from './pages/teacher/TeacherPage';

function resolveHomePath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  return '/student';
}

function HomeRedirect() {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={resolveHomePath(role)} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute allowedRole="student" />}>
        <Route path="/student" element={<StudentHomePage />} />
        <Route path="/student/attempt/:attemptId" element={<AttemptPage />} />
        <Route path="/student/result/:attemptId" element={<ResultPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRole="admin" />}>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/tests/:testId/edit" element={<TestEditorPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRole="teacher" />}>
        <Route path="/teacher" element={<TeacherPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;

