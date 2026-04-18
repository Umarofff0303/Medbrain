const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || 'Server xatoligi');
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const authApi = {
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token })
};

export const studentApi = {
  updateProfile: (payload, token) =>
    request('/student/profile', { method: 'PATCH', token, body: payload }),
  updateSelection: (payload, token) =>
    request('/student/selection', { method: 'PATCH', token, body: payload }),
  catalog: (token) => request('/student/catalog', { token }),
  testsByTopic: (topicId, token) => request(`/student/topics/${topicId}/tests`, { token }),
  startTest: (testId, token) => request(`/student/tests/${testId}/start`, { method: 'POST', token }),
  attempt: (attemptId, token) => request(`/student/attempts/${attemptId}`, { token }),
  submitAttempt: (attemptId, payload, token) =>
    request(`/student/attempts/${attemptId}/submit`, { method: 'POST', token, body: payload }),
  attemptResult: (attemptId, token) => request(`/student/attempts/${attemptId}/result`, { token })
};

export const adminApi = {
  faculties: (token) => request('/admin/faculties', { token }),
  createFaculty: (payload, token) => request('/admin/faculties', { method: 'POST', token, body: payload }),
  updateFaculty: (id, payload, token) =>
    request(`/admin/faculties/${id}`, { method: 'PUT', token, body: payload }),
  deleteFaculty: (id, token) => request(`/admin/faculties/${id}`, { method: 'DELETE', token }),

  directions: (token) => request('/admin/directions', { token }),
  createDirection: (payload, token) => request('/admin/directions', { method: 'POST', token, body: payload }),
  updateDirection: (id, payload, token) =>
    request(`/admin/directions/${id}`, { method: 'PUT', token, body: payload }),
  deleteDirection: (id, token) => request(`/admin/directions/${id}`, { method: 'DELETE', token }),

  topics: (token) => request('/admin/topics', { token }),
  createTopic: (payload, token) => request('/admin/topics', { method: 'POST', token, body: payload }),
  updateTopic: (id, payload, token) => request(`/admin/topics/${id}`, { method: 'PUT', token, body: payload }),
  deleteTopic: (id, token) => request(`/admin/topics/${id}`, { method: 'DELETE', token }),

  tests: (token) => request('/admin/tests', { token }),
  testById: (id, token) => request(`/admin/tests/${id}`, { token }),
  createTest: (payload, token) => request('/admin/tests', { method: 'POST', token, body: payload }),
  updateTest: (id, payload, token) => request(`/admin/tests/${id}`, { method: 'PUT', token, body: payload }),
  deleteTest: (id, token) => request(`/admin/tests/${id}`, { method: 'DELETE', token }),
  publishTest: (id, payload, token) => request(`/admin/tests/${id}/publish`, { method: 'PATCH', token, body: payload }),
  testAccessMatrix: (id, token) => request(`/admin/tests/${id}/access`, { token }),
  setStudentTestAccess: (testId, studentId, payload, token) =>
    request(`/admin/tests/${testId}/access/${studentId}`, { method: 'PUT', token, body: payload }),

  students: (token) => request('/admin/students', { token }),
  importStudents: (payload, token) => request('/admin/students/import', { method: 'POST', token, body: payload }),
  updateStudent: (id, payload, token) => request(`/admin/students/${id}`, { method: 'PUT', token, body: payload }),
  deleteStudent: (id, token) => request(`/admin/students/${id}`, { method: 'DELETE', token }),
  teachers: (token) => request('/admin/teachers', { token }),
  createTeacher: (payload, token) => request('/admin/teachers', { method: 'POST', token, body: payload }),
  updateTeacher: (id, payload, token) => request(`/admin/teachers/${id}`, { method: 'PUT', token, body: payload }),
  deleteTeacher: (id, token) => request(`/admin/teachers/${id}`, { method: 'DELETE', token }),
  stats: (token) => request('/admin/stats', { token })
};
