import {
  Alert,
  Button,
  Card,
  Cascader,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Tabs,
  Tag,
  Typography
} from 'antd';
import {
  CheckOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  SaveOutlined,
  UnorderedListOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';
import { useAuth } from '../../context/useAuth';
import { adminApi } from '../../lib/api';
import {
  createStudentImportTemplateCsv,
  createStudentsExportCsv,
  downloadCsvFile,
  parseStudentImportCsv
} from '../../lib/studentCsv';
import { isAllowedTopicForScope } from '../../lib/topicPolicy';
import { buildTopicGroups } from '../../lib/topicGroups';

const { Text } = Typography;

function emptyQuestion() {
  return {
    text: '',
    options: { A: '', B: '', C: '', D: '' },
    correctOption: 'A'
  };
}

function initialTestForm() {
  return {
    title: '',
    topicId: '',
    timeLimitMinutes: 20,
    published: false,
    questions: [emptyQuestion()]
  };
}

function initialTeacherForm() {
  return {
    fullName: '',
    username: '',
    subjectName: '',
    facultyId: '',
    directionId: '',
    password: ''
  };
}

function parseStudentFullName(rawFullName) {
  const raw = String(rawFullName || '').trim();

  if (!raw) {
    return { groupName: 'Kiritilmagan', displayName: '' };
  }

  if (!raw.includes('|')) {
    return { groupName: 'Kiritilmagan', displayName: raw };
  }

  const [groupPart, ...nameParts] = raw.split('|');
  const groupName = groupPart.trim() || 'Kiritilmagan';
  const displayName = nameParts.join('|').trim() || '';

  return { groupName, displayName };
}

function splitDisplayName(displayName) {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 3) {
    return {
      lastName: parts[0],
      firstName: parts[1],
      fatherName: parts.slice(2).join(' ')
    };
  }

  if (parts.length === 2) {
    return {
      lastName: parts[0],
      firstName: parts[1],
      fatherName: ''
    };
  }

  return {
    lastName: parts[0] || '',
    firstName: '',
    fatherName: ''
  };
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatAttemptStatus(status) {
  if (status === 'submitted') return 'Yakunlangan';
  if (status === 'auto_submitted') return 'Avto yakunlangan';
  if (status === 'in_progress') return 'Jarayonda';
  return status || '-';
}

export function AdminPage() {
  const { token, role, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState('');

  const [faculties, setFaculties] = useState([]);
  const [directions, setDirections] = useState([]);
  const [topics, setTopics] = useState([]);
  const [tests, setTests] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [statsOverview, setStatsOverview] = useState(null);
  const [recentAttempts, setRecentAttempts] = useState([]);

  const [studentSearchUrl, setStudentSearchUrl] = useState('');
  const [studentCsvAlert, setStudentCsvAlert] = useState(null);
  const [studentCsvImporting, setStudentCsvImporting] = useState(false);
  const studentCsvInputRef = useRef(null);

  const [facultyName, setFacultyName] = useState('');
  const [directionForm, setDirectionForm] = useState({ name: '', facultyId: '' });
  const [topicForm, setTopicForm] = useState({ name: '', facultyId: '', directionId: '' });
  const [testForm, setTestForm] = useState(initialTestForm);
  const [editingTestId, setEditingTestId] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState('');
  const [studentEditModalOpen, setStudentEditModalOpen] = useState(false);
  const [studentEditSaving, setStudentEditSaving] = useState(false);
  const [studentEditError, setStudentEditError] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentEditForm] = Form.useForm();
  const [editingFacultyId, setEditingFacultyId] = useState('');
  const [editingDirectionId, setEditingDirectionId] = useState('');
  const [editingTopicId, setEditingTopicId] = useState('');
  const [editingTeacherId, setEditingTeacherId] = useState('');
  const [teacherForm, setTeacherForm] = useState(initialTeacherForm);

  const [context, setContext] = useState({
    facultyId: '',
    directionId: '',
    topicId: ''
  });

  async function loadAll(options = {}) {
    const shouldBlock = options.blocking ?? !hasLoadedOnce;

    if (shouldBlock) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError('');

    try {
      const [f, d, t, testResp, stResp, teacherResp, statsResp] = await Promise.all([
        adminApi.faculties(token),
        adminApi.directions(token),
        adminApi.topics(token),
        adminApi.tests(token),
        adminApi.students(token),
        isAdmin ? adminApi.teachers(token) : Promise.resolve({ teachers: [] }),
        isAdmin ? adminApi.stats(token) : Promise.resolve({ overview: null, recentAttempts: [] })
      ]);

      setFaculties(f.faculties || []);
      setDirections(d.directions || []);
      setTopics(t.topics || []);
      setTests(testResp.tests || []);
      setStudents(stResp.students || []);
      setTeachers(teacherResp.teachers || []);
      setStatsOverview(statsResp.overview || null);
      setRecentAttempts(statsResp.recentAttempts || []);
    } catch (loadError) {
      setError(loadError.message || 'Admin maʼlumotlarini yuklashda xato.');
    } finally {
      if (shouldBlock) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    loadAll({ blocking: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  async function handleAction(action) {
    setError('');
    try {
      await action();
      await loadAll({ blocking: false });
      return true;
    } catch (actionError) {
      if (actionError?.status === 403) {
        setError("Bu amal faqat administrator uchun ruxsat etilgan.");
      } else {
        setError(actionError.message || 'Amal bajarilmadi.');
      }
      return false;
    }
  }

  function openStudentCsvPicker() {
    setStudentCsvAlert(null);
    studentCsvInputRef.current?.click();
  }

  function downloadStudentTemplate() {
    downloadCsvFile('admin-student-import-template.csv', createStudentImportTemplateCsv());
  }

  function exportStudentsCsv() {
    if (filteredStudents.length === 0) {
      setStudentCsvAlert({ type: 'error', message: 'Export qilish uchun talabalar topilmadi.' });
      return;
    }

    downloadCsvFile('admin-students.csv', createStudentsExportCsv(filteredStudents));
    setStudentCsvAlert({ type: 'success', message: 'Talabalar CSV fayli yuklab olindi.' });
  }

  async function handleStudentCsvImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setStudentCsvAlert(null);
    setStudentCsvImporting(true);

    try {
      const text = await file.text();
      const studentsToImport = parseStudentImportCsv(text);
      const response = await adminApi.importStudents(
        {
          students: studentsToImport,
          scope: {
            facultyId: context.facultyId || null,
            directionId: context.directionId || null
          }
        },
        token
      );

      await loadAll({ blocking: false });
      setStudentCsvAlert({
        type: 'success',
        message: `${response.createdCount || studentsToImport.length} ta talaba CSV orqali qo'shildi.`
      });
    } catch (importError) {
      setStudentCsvAlert({ type: 'error', message: importError.message || 'CSV importda xato yuz berdi.' });
    } finally {
      setStudentCsvImporting(false);
    }
  }

  const directionsByFaculty = useMemo(() => {
    const map = new Map();
    for (const direction of directions) {
      const key = direction.faculty_id;
      const list = map.get(key) || [];
      list.push(direction);
      map.set(key, list);
    }
    return map;
  }, [directions]);

  const facultyNameById = useMemo(
    () => new Map(faculties.map((faculty) => [String(faculty.id), faculty.name])),
    [faculties]
  );

  const directionNameById = useMemo(
    () => new Map(directions.map((direction) => [String(direction.id), direction.name])),
    [directions]
  );

  const visibleTopics = useMemo(
    () =>
      topics.filter((topic) =>
        isAllowedTopicForScope(
          facultyNameById.get(String(topic.faculty_id)),
          directionNameById.get(String(topic.direction_id)),
          topic.name
        )
      ),
    [directionNameById, facultyNameById, topics]
  );

  const topicsByDirection = useMemo(() => {
    const map = new Map();
    for (const topic of visibleTopics) {
      const key = topic.direction_id;
      const list = map.get(key) || [];
      list.push(topic);
      map.set(key, list);
    }
    return map;
  }, [visibleTopics]);

  const groupedTopics = useMemo(() => buildTopicGroups(visibleTopics), [visibleTopics]);

  const groupedTopicsByDirection = useMemo(() => {
    const map = new Map();

    for (const topic of groupedTopics) {
      const key = topic.direction_id;
      const list = map.get(key) || [];
      list.push(topic);
      map.set(key, list);
    }

    return map;
  }, [groupedTopics]);

  const groupedTopicIdsByRepresentativeId = useMemo(() => {
    const map = new Map();

    for (const topic of groupedTopics) {
      map.set(String(topic.id), topic.topicIds);
    }

    return map;
  }, [groupedTopics]);

  const representativeTopicIdByTopicId = useMemo(() => {
    const map = new Map();

    for (const topic of groupedTopics) {
      for (const rawTopicId of topic.topicIds) {
        map.set(String(rawTopicId), topic.id);
      }
    }

    return map;
  }, [groupedTopics]);

  const fullTreeOptions = useMemo(
    () =>
      faculties.map((faculty) => ({
        value: faculty.id,
        label: faculty.name,
        children: (directionsByFaculty.get(faculty.id) || []).map((direction) => ({
          value: direction.id,
          label: direction.name,
          children: (groupedTopicsByDirection.get(direction.id) || []).map((topic) => ({
            value: topic.id,
            label: topic.name
          }))
        }))
      })),
    [faculties, directionsByFaculty, groupedTopicsByDirection]
  );

  const facultyDirectionOptions = useMemo(
    () =>
      faculties.map((faculty) => ({
        value: faculty.id,
        label: faculty.name,
        children: (directionsByFaculty.get(faculty.id) || []).map((direction) => ({
          value: direction.id,
          label: direction.name
        }))
      })),
    [faculties, directionsByFaculty]
  );

  const facultyOptions = faculties.map((faculty) => ({ label: faculty.name, value: faculty.id }));
  const teacherDirectionOptions = useMemo(
    () =>
      teacherForm.facultyId
        ? directions
            .filter((direction) => direction.faculty_id === teacherForm.facultyId)
            .map((direction) => ({ label: direction.name, value: direction.id }))
        : [],
    [directions, teacherForm.facultyId]
  );
  const teacherTopicOptions = useMemo(() => {
    const scopedTopics = teacherForm.directionId
      ? groupedTopics.filter((topic) => topic.direction_id === teacherForm.directionId)
      : teacherForm.facultyId
        ? groupedTopics.filter((topic) => topic.faculty_id === teacherForm.facultyId)
        : [];

    const mappedTopics = scopedTopics.map((topic) => ({
      label: topic.name,
      value: topic.name
    }));

    const currentValue = String(teacherForm.subjectName || '').trim();

    if (currentValue && !mappedTopics.some((topic) => topic.value === currentValue)) {
      mappedTopics.unshift({
        label: currentValue,
        value: currentValue
      });
    }

    return mappedTopics;
  }, [groupedTopics, teacherForm.directionId, teacherForm.facultyId, teacherForm.subjectName]);

  const filteredDirections = useMemo(
    () => (context.facultyId ? directions.filter((direction) => direction.faculty_id === context.facultyId) : directions),
    [context.facultyId, directions]
  );

  const filteredTopics = useMemo(() => {
    if (context.directionId) {
      return visibleTopics.filter((topic) => topic.direction_id === context.directionId);
    }

    if (context.facultyId) {
      return visibleTopics.filter((topic) => topic.faculty_id === context.facultyId);
    }

    return visibleTopics;
  }, [context.directionId, context.facultyId, visibleTopics]);

  const filteredTests = useMemo(
    () =>
      (context.topicId
        ? tests.filter((test) =>
            (groupedTopicIdsByRepresentativeId.get(String(context.topicId)) || [context.topicId]).includes(test.topic_id)
          )
        : tests
      ).filter((test) =>
        visibleTopics.some((topic) => String(topic.id) === String(test.topic_id))
      ),
    [context.topicId, groupedTopicIdsByRepresentativeId, tests, visibleTopics]
  );

  const filteredStudents = useMemo(() => {
    const query = studentSearchUrl.trim().toLowerCase();

    if (!query) {
      return students;
    }

    return students.filter((student) => {
      const identity = parseStudentFullName(student.full_name);
      const values = [
        student.username || '',
        student.full_name || '',
        identity.groupName,
        identity.displayName,
        student.lastAttempt?.testTitle || ''
      ];

      return values.some((value) => String(value).toLowerCase().includes(query));
    });
  }, [studentSearchUrl, students]);

  useEffect(() => {
    if (!expandedStudentId) return;
    const exists = filteredStudents.some((student) => student.id === expandedStudentId);
    if (!exists) {
      setExpandedStudentId('');
    }
  }, [expandedStudentId, filteredStudents]);

  const contextValue = useMemo(() => {
    const result = [];
    if (context.facultyId) result.push(context.facultyId);
    if (context.directionId) result.push(context.directionId);
    if (context.topicId) result.push(context.topicId);
    return result;
  }, [context.directionId, context.facultyId, context.topicId]);

  const topicScopeValue = useMemo(() => {
    if (!topicForm.facultyId) return [];
    if (!topicForm.directionId) return [topicForm.facultyId];
    return [topicForm.facultyId, topicForm.directionId];
  }, [topicForm.directionId, topicForm.facultyId]);

  const testTopicPath = useMemo(() => {
    if (!testForm.topicId) return [];
    const topic = visibleTopics.find((item) => item.id === testForm.topicId) || topics.find((item) => item.id === testForm.topicId);
    if (!topic) return [];
    return [topic.faculty_id, topic.direction_id, representativeTopicIdByTopicId.get(String(topic.id)) || topic.id];
  }, [representativeTopicIdByTopicId, testForm.topicId, topics, visibleTopics]);

  function handleContextChange(path) {
    const nextFacultyId = path?.[0] || '';
    const nextDirectionId = path?.[1] || '';
    const nextTopicId = path?.[2] || '';

    setContext({
      facultyId: nextFacultyId,
      directionId: nextDirectionId,
      topicId: nextTopicId
    });

    setDirectionForm((prev) => ({ ...prev, facultyId: nextFacultyId }));
    setTopicForm((prev) => ({
      ...prev,
      facultyId: nextFacultyId,
      directionId: nextDirectionId
    }));

    setTestForm((prev) => ({
      ...prev,
      topicId: nextTopicId
    }));
  }

  function resetTestForm() {
    setEditingTestId('');
    setTestForm(initialTestForm());
  }

  function normalizeQuestion(question = {}) {
    return {
      text: question.text || '',
      options: {
        A: question.options?.A || '',
        B: question.options?.B || '',
        C: question.options?.C || '',
        D: question.options?.D || ''
      },
      correctOption: question.correctOption || 'A'
    };
  }

  async function startEditTest(testId) {
    navigate(`/admin/tests/${testId}/edit`);
  }

  async function saveTestForm() {
    if (!testForm.title || !testForm.topicId || !testForm.timeLimitMinutes) {
      setError('Test nomi, mavzu va vaqt chegarasi majburiy.');
      return;
    }

    const isInvalidQuestion = testForm.questions.some(
      (question) =>
        !question.text ||
        !question.options.A ||
        !question.options.B ||
        !question.options.C ||
        !question.options.D
    );

    if (isInvalidQuestion) {
      setError('Savol va barcha variantlar to‘ldirilishi kerak.');
      return;
    }

    const payload = {
      title: testForm.title.trim(),
      topicId: testForm.topicId,
      timeLimitMinutes: Number(testForm.timeLimitMinutes),
      published: testForm.published,
      questions: testForm.questions.map((question, index) => ({
        text: question.text.trim(),
        options: {
          A: question.options.A.trim(),
          B: question.options.B.trim(),
          C: question.options.C.trim(),
          D: question.options.D.trim()
        },
        correctOption: question.correctOption,
        orderNo: index + 1
      }))
    };

    const succeeded = await handleAction(() =>
      editingTestId
        ? adminApi.updateTest(editingTestId, payload, token)
        : adminApi.createTest(payload, token)
    );

    if (succeeded) {
      resetTestForm();
    }
  }

  function startEditFaculty(faculty) {
    setEditingFacultyId(faculty.id);
    setFacultyName(faculty.name || '');
  }

  function resetFacultyForm() {
    setEditingFacultyId('');
    setFacultyName('');
  }

  async function saveFaculty() {
    const name = String(facultyName || '').trim();
    if (!name) {
      setError('Faculty nomini kiriting.');
      return;
    }

    const succeeded = await handleAction(() =>
      editingFacultyId ? adminApi.updateFaculty(editingFacultyId, { name }, token) : adminApi.createFaculty({ name }, token)
    );

    if (succeeded) {
      resetFacultyForm();
    }
  }

  function startEditDirection(direction) {
    setEditingDirectionId(direction.id);
    setDirectionForm({
      name: direction.name || '',
      facultyId: direction.faculty_id || ''
    });
  }

  function resetDirectionForm() {
    setEditingDirectionId('');
    setDirectionForm({ name: '', facultyId: '' });
  }

  async function saveDirectionForm() {
    const name = String(directionForm.name || '').trim();
    if (!name || !directionForm.facultyId) {
      setError("Yo'nalish nomi va fakultetni kiriting.");
      return;
    }

    const payload = {
      name,
      facultyId: directionForm.facultyId
    };

    const succeeded = await handleAction(() =>
      editingDirectionId
        ? adminApi.updateDirection(editingDirectionId, payload, token)
        : adminApi.createDirection(payload, token)
    );

    if (succeeded) {
      resetDirectionForm();
    }
  }

  function startEditTopic(topic) {
    setEditingTopicId(topic.id);
    setTopicForm({
      name: topic.name || '',
      facultyId: topic.faculty_id || '',
      directionId: topic.direction_id || ''
    });
  }

  function resetTopicForm() {
    setEditingTopicId('');
    setTopicForm({ name: '', facultyId: '', directionId: '' });
  }

  async function saveTopicForm() {
    const name = String(topicForm.name || '').trim();
    if (!name || !topicForm.facultyId || !topicForm.directionId) {
      setError('Mavzu nomi, fakultet va yo‘nalishni kiriting.');
      return;
    }

    const payload = {
      name,
      facultyId: topicForm.facultyId,
      directionId: topicForm.directionId
    };

    const succeeded = await handleAction(() =>
      editingTopicId ? adminApi.updateTopic(editingTopicId, payload, token) : adminApi.createTopic(payload, token)
    );

    if (succeeded) {
      resetTopicForm();
    }
  }

  function startEditTeacher(teacher) {
    setEditingTeacherId(teacher.id);
    setTeacherForm({
      fullName: teacher.full_name || '',
      username: teacher.username || '',
      subjectName: teacher.subject_name || '',
      facultyId: teacher.faculty_id || '',
      directionId: teacher.direction_id || '',
      password: ''
    });
  }

  function resetTeacherForm() {
    setEditingTeacherId('');
    setTeacherForm(initialTeacherForm());
  }

  async function saveTeacherForm() {
    if (!isAdmin) return;

    const payload = {
      fullName: String(teacherForm.fullName || '').trim(),
      username: String(teacherForm.username || '').trim(),
      subjectName: String(teacherForm.subjectName || '').trim(),
      facultyId: teacherForm.facultyId,
      directionId: teacherForm.directionId
    };

    const password = String(teacherForm.password || '').trim();

    if (!payload.fullName || !payload.username || !payload.subjectName || !payload.facultyId || !payload.directionId) {
      setError("Ustoz uchun ism, login, mavzu, fakultet va yo'nalish majburiy.");
      return;
    }

    if (!editingTeacherId && !password) {
      setError('Yangi ustoz uchun parol majburiy.');
      return;
    }

    const requestPayload = {
      ...payload,
      ...(password ? { password } : {})
    };

    const succeeded = await handleAction(() =>
      editingTeacherId
        ? adminApi.updateTeacher(editingTeacherId, requestPayload, token)
        : adminApi.createTeacher(requestPayload, token)
    );

    if (succeeded) {
      resetTeacherForm();
    }
  }

  async function editStudent(student) {
    const identity = parseStudentFullName(student.full_name);
    const nameParts = splitDisplayName(identity.displayName);

    setStudentEditError('');
    setEditingStudent(student);
    studentEditForm.setFieldsValue({
      username: student.username || '',
      groupName: identity.groupName === 'Kiritilmagan' ? '' : identity.groupName,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      fatherName: nameParts.fatherName,
      password: ''
    });
    setStudentEditModalOpen(true);
  }

  function closeStudentEditModal(force = false) {
    if (studentEditSaving && !force) return;
    setStudentEditModalOpen(false);
    setStudentEditError('');
    setEditingStudent(null);
    studentEditForm.resetFields();
  }

  async function submitStudentEdit() {
    if (!editingStudent) return;

    try {
      const values = await studentEditForm.validateFields();
      setStudentEditSaving(true);
      setStudentEditError('');

      const payload = {
        username: values.username.trim(),
        groupName: values.groupName.trim(),
        fullName: `${values.lastName.trim()} ${values.firstName.trim()} ${values.fatherName.trim()}`.trim(),
        password: values.password ? values.password.trim() : undefined
      };

      await adminApi.updateStudent(editingStudent.id, payload, token);
      await loadAll();
      closeStudentEditModal(true);
    } catch (studentEditSubmitError) {
      if (studentEditSubmitError?.errorFields) {
        return;
      }

      setStudentEditError(studentEditSubmitError.message || "Talaba ma'lumotlarini saqlab bo'lmadi.");
    } finally {
      setStudentEditSaving(false);
    }
  }

  const tabItems = [
    ...(isAdmin
      ? [
          {
            key: 'analytics',
            label: 'Tahlil',
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Row gutter={[12, 12]}>
                  <Col xs={12} md={8} xl={4}>
                    <Card className="elevated-card">
                      <Statistic title="Foydalanuvchilar" value={statsOverview?.users || 0} />
                    </Card>
                  </Col>
                  <Col xs={12} md={8} xl={4}>
                    <Card className="elevated-card">
                      <Statistic title="Fakultetlar" value={statsOverview?.faculties || 0} />
                    </Card>
                  </Col>
                  <Col xs={12} md={8} xl={4}>
                    <Card className="elevated-card">
                      <Statistic title="Yo'nalishlar" value={statsOverview?.directions || 0} />
                    </Card>
                  </Col>
                  <Col xs={12} md={8} xl={4}>
                    <Card className="elevated-card">
                      <Statistic title="Mavzular" value={statsOverview?.topics || 0} />
                    </Card>
                  </Col>
                  <Col xs={12} md={8} xl={4}>
                    <Card className="elevated-card">
                      <Statistic title="Testlar" value={statsOverview?.tests || 0} />
                    </Card>
                  </Col>
                  <Col xs={12} md={8} xl={4}>
                    <Card className="elevated-card">
                      <Statistic title="Urinishlar" value={statsOverview?.attempts || 0} />
                    </Card>
                  </Col>
                </Row>

                <Card className="elevated-card" title={`So'nggi urinishlar (${recentAttempts.length})`} bodyStyle={{ padding: 0 }}>
                  <div style={{ maxHeight: 360, overflowY: 'auto', padding: 16 }}>
                    <List
                      dataSource={recentAttempts}
                      locale={{ emptyText: <Empty description="Hozircha urinishlar yo'q" /> }}
                      renderItem={(attempt) => (
                        <List.Item>
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <Space wrap size={[8, 8]}>
                              <Text style={{ color: '#fff' }}>{attempt.studentName || attempt.studentUsername || 'Nomaʼlum talaba'}</Text>
                              <Tag color="blue">{attempt.testTitle || "Noma'lum test"}</Tag>
                              <Tag color={attempt.status === 'in_progress' ? 'gold' : 'green'}>{formatAttemptStatus(attempt.status)}</Tag>
                            </Space>
                            <Text style={{ color: '#cbd5e1' }}>
                              Login: {attempt.studentUsername || '-'} | Ball: {typeof attempt.score === 'number' ? attempt.score : '-'} |{' '}
                              {formatDateTime(attempt.submittedAt)}
                            </Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </div>
                </Card>
              </Space>
            )
          }
        ]
      : []),
    {
      key: 'faculties',
      label: 'Faculties',
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Card title={editingFacultyId ? 'Faculty tahrirlash' : isAdmin ? 'Faculty Management' : 'Faculty'} className="elevated-card">
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="Yangi faculty nomi"
                value={facultyName}
                onChange={(event) => setFacultyName(event.target.value)}
              />
              <Button
                type="primary"
                icon={editingFacultyId ? <SaveOutlined /> : <PlusOutlined />}
                onClick={saveFaculty}
                disabled={isTeacher && !editingFacultyId}
              >
                {editingFacultyId ? 'Yangilash' : isAdmin ? "Qo'shish" : "Ro'yxatdan tanlang"}
              </Button>
            </Space.Compact>
            {editingFacultyId && (
              <Button className="action-muted-btn" style={{ marginTop: 10 }} onClick={resetFacultyForm}>
                Bekor qilish
              </Button>
            )}
          </Card>

          <Card className="elevated-card" title="Mavjud faculties" bodyStyle={{ padding: 0 }}>
            <div style={{ maxHeight: 350, overflowY: 'auto', padding: 16 }}>
            <List
              dataSource={faculties}
              locale={{ emptyText: <Empty description="Facultylar yo‘q" /> }}
              renderItem={(faculty) => (
                <List.Item
                  actions={[
                    <Button
                      key="edit"
                      className="action-edit-btn"
                      icon={<EditOutlined />}
                      onClick={() => startEditFaculty(faculty)}
                    >
                      Tahrirlash
                    </Button>,
                    isAdmin && (
                      <Popconfirm
                      key="delete"
                      title="Faculty o‘chirilsinmi?"
                      onConfirm={() => handleAction(() => adminApi.deleteFaculty(faculty.id, token))}
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        O'chirish
                      </Button>
                                          </Popconfirm>
                    )
                  ]}
                >
                  <Text style={{ color: '#fff' }}>{faculty.name}</Text>
                </List.Item>
              )}
            />
            </div>
          </Card>
        </Space>
      )
    },
    {
      key: 'directions',
      label: 'Directions',
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Card title={editingDirectionId ? "Yo'nalishni tahrirlash" : isAdmin ? 'Direction Management' : "Yo'nalishlar"} className="elevated-card">
            <Row gutter={12}>
              <Col xs={24} md={10}>
                <Input
                  placeholder="Direction nomi"
                  value={directionForm.name}
                  onChange={(event) => setDirectionForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </Col>
              <Col xs={24} md={10}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Faculty tanlang"
                  options={facultyOptions}
                  value={directionForm.facultyId || undefined}
                  onChange={(value) => setDirectionForm((prev) => ({ ...prev, facultyId: value || '' }))}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} md={4}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    icon={editingDirectionId ? <SaveOutlined /> : <PlusOutlined />}
                    block
                    onClick={saveDirectionForm}
                    disabled={isTeacher && !editingDirectionId}
                  >
                    {editingDirectionId ? 'Yangilash' : isAdmin ? "Qo'shish" : "Ro'yxatdan tanlang"}
                  </Button>
                  {editingDirectionId && (
                    <Button className="action-muted-btn" block onClick={resetDirectionForm}>
                      Bekor qilish
                    </Button>
                  )}
                </Space>
              </Col>
            </Row>
          </Card>

          <Card className="elevated-card" title="Mavjud directions" bodyStyle={{ padding: 0 }}>
            <div style={{ maxHeight: 350, overflowY: 'auto', padding: 16 }}>
            <List
              dataSource={filteredDirections}
              locale={{ emptyText: <Empty description="Directionlar yo‘q" /> }}
              renderItem={(direction) => (
                <List.Item
                  actions={[
                    <Button
                      key="edit"
                      className="action-edit-btn"
                      icon={<EditOutlined />}
                      onClick={() => startEditDirection(direction)}
                    >
                      Tahrirlash
                    </Button>,
                    isAdmin && (
                      <Popconfirm
                      key="delete"
                      title="Direction o‘chirilsinmi?"
                      onConfirm={() => handleAction(() => adminApi.deleteDirection(direction.id, token))}
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        O'chirish
                      </Button>
                                          </Popconfirm>
                    )
                  ]}
                >
                  <Text style={{ color: '#fff' }}>
                    {direction.name} ({faculties.find((faculty) => faculty.id === direction.faculty_id)?.name || 'Nomaʼlum'})
                  </Text>
                </List.Item>
              )}
            />
            </div>
          </Card>
        </Space>
      )
    },
    {
      key: 'topics',
      label: 'Topics',
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Card title={editingTopicId ? 'Mavzuni tahrirlash' : isAdmin ? 'Topic Management' : 'Mavzular'} className="elevated-card">
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Input
                  placeholder="Topic nomi"
                  value={topicForm.name}
                  onChange={(event) => setTopicForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </Col>
              <Col xs={24} md={12}>
                <Cascader
                  showSearch
                  options={facultyDirectionOptions}
                  value={topicScopeValue}
                  placeholder="Fakultet / Yo‘nalishni bitta joydan tanlang"
                  onChange={(path) =>
                    setTopicForm((prev) => ({
                      ...prev,
                      facultyId: path?.[0] || '',
                      directionId: path?.[1] || ''
                    }))
                  }
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} md={4}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    icon={editingTopicId ? <SaveOutlined /> : <PlusOutlined />}
                    block
                    onClick={saveTopicForm}
                    disabled={isTeacher && !editingTopicId}
                  >
                    {editingTopicId ? 'Yangilash' : isAdmin ? "Qo'shish" : "Ro'yxatdan tanlang"}
                  </Button>
                  {editingTopicId && (
                    <Button className="action-muted-btn" block onClick={resetTopicForm}>
                      Bekor qilish
                    </Button>
                  )}
                </Space>
              </Col>
            </Row>
          </Card>

          <Card className="elevated-card" title="Mavjud topics" bodyStyle={{ padding: 0 }}>
            <div style={{ maxHeight: 350, overflowY: 'auto', padding: 16 }}>
            <List
              dataSource={filteredTopics}
              locale={{ emptyText: <Empty description="Topiclar yo‘q" /> }}
              renderItem={(topic) => (
                <List.Item
                  actions={[
                    <Button
                      key="edit"
                      className="action-edit-btn"
                      icon={<EditOutlined />}
                      onClick={() => startEditTopic(topic)}
                    >
                      Tahrirlash
                    </Button>,
                    isAdmin && (
                      <Popconfirm
                      key="delete"
                      title="Topic o‘chirilsinmi?"
                      onConfirm={() => handleAction(() => adminApi.deleteTopic(topic.id, token))}
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        O'chirish
                      </Button>
                                          </Popconfirm>
                    )
                  ]}
                >
                  <Text style={{ color: '#fff' }}>
                    {topic.name} ({directions.find((direction) => direction.id === topic.direction_id)?.name || 'Nomaʼlum'})
                  </Text>
                </List.Item>
              )}
            />
            </div>
          </Card>
        </Space>
      )
    },
    {
      key: 'tests',
      label: 'Tests',
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Card title={editingTestId ? 'Testni tahrirlash' : isAdmin ? 'Yangi test yaratish' : 'Testlarni ko‘rish'} className="elevated-card">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Input
                    placeholder="Test nomi"
                    value={testForm.title}
                    onChange={(event) => setTestForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </Col>
                <Col xs={24} md={10}>
                  <Cascader
                    showSearch
                    options={fullTreeOptions}
                    value={testTopicPath}
                    placeholder="Fakultet / Yo‘nalish / Mavzuni bitta joydan tanlang"
                    onChange={(path) =>
                      setTestForm((prev) => ({
                        ...prev,
                        topicId: path?.[2] || ''
                      }))
                    }
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col xs={24} md={3}>
                  <InputNumber
                    min={1}
                    max={300}
                    value={testForm.timeLimitMinutes}
                    onChange={(value) =>
                      setTestForm((prev) => ({ ...prev, timeLimitMinutes: Number(value || 1) }))
                    }
                    style={{ width: '100%' }}
                    addonAfter="min"
                  />
                </Col>
                <Col xs={24} md={3}>
                  <Checkbox
                    checked={testForm.published}
                    onChange={(event) => setTestForm((prev) => ({ ...prev, published: event.target.checked }))}
                  >
                    Publish
                  </Checkbox>
                </Col>
              </Row>

              {editingTestId && <Text style={{ color: '#faad14' }}>Edit rejimi yoqilgan. O'zgarishlar ushbu testga saqlanadi.</Text>}

              <div className="sticky-action-bar admin-test-action-bar">
                <Space wrap>
                  <Button
                    className="action-create-btn"
                    icon={<PlusOutlined />}
                    disabled={isTeacher && !editingTestId}
                    onClick={() =>
                      setTestForm((prev) => ({
                        ...prev,
                        questions: [...prev.questions, emptyQuestion()]
                      }))
                    }
                  >
                    Savol qo'shish
                  </Button>

                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={saveTestForm}
                    disabled={isTeacher && !editingTestId}
                  >
                    {editingTestId ? 'Testni yangilash' : isAdmin ? 'Testni saqlash' : "Tahrirlash uchun test tanlang"}
                  </Button>

                  {editingTestId && <Button className="action-muted-btn" onClick={resetTestForm}>Bekor qilish</Button>}
                </Space>
              </div>

              {testForm.questions.map((question, index) => (
                <Card key={`question-${index}`} size="small" title={`Savol ${index + 1}`}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Input
                      placeholder="Savol matni"
                      value={question.text}
                      onChange={(event) =>
                        setTestForm((prev) => {
                          const nextQuestions = [...prev.questions];
                          nextQuestions[index] = { ...nextQuestions[index], text: event.target.value };
                          return { ...prev, questions: nextQuestions };
                        })
                      }
                    />

                    <Row gutter={8}>
                      {['A', 'B', 'C', 'D'].map((optionKey) => (
                        <Col xs={24} md={12} key={optionKey}>
                          <Input
                            placeholder={`Variant ${optionKey}`}
                            value={question.options[optionKey]}
                            onChange={(event) =>
                              setTestForm((prev) => {
                                const nextQuestions = [...prev.questions];
                                nextQuestions[index] = {
                                  ...nextQuestions[index],
                                  options: {
                                    ...nextQuestions[index].options,
                                    [optionKey]: event.target.value
                                  }
                                };
                                return { ...prev, questions: nextQuestions };
                              })
                            }
                          />
                        </Col>
                      ))}
                    </Row>

                    <Space wrap>
                      <Select
                        value={question.correctOption}
                        style={{ width: 180 }}
                        options={[
                          { value: 'A', label: "To'g'ri javob: A" },
                          { value: 'B', label: "To'g'ri javob: B" },
                          { value: 'C', label: "To'g'ri javob: C" },
                          { value: 'D', label: "To'g'ri javob: D" }
                        ]}
                        onChange={(value) =>
                          setTestForm((prev) => {
                            const nextQuestions = [...prev.questions];
                            nextQuestions[index] = { ...nextQuestions[index], correctOption: value };
                            return { ...prev, questions: nextQuestions };
                          })
                        }
                      />

                      {testForm.questions.length > 1 && (
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() =>
                            setTestForm((prev) => ({
                              ...prev,
                              questions: prev.questions.filter((_, questionIndex) => questionIndex !== index)
                            }))
                          }
                        >
                          Savolni o'chirish
                        </Button>
                      )}
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>

          <Card title="Mavjud testlar" className="elevated-card" bodyStyle={{ padding: 0 }}>
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: 16 }}>
            <List
              dataSource={filteredTests}
              locale={{ emptyText: <Empty description="Testlar yo‘q" /> }}
              renderItem={(test) => (
                <List.Item
                  actions={[
                    <Space key="status" size={6}>
                      <Tag color={test.published ? 'success' : 'default'}>
                        {test.published ? 'Published' : 'Draft'}
                      </Tag>
                      <Switch
                        checked={test.published}
                        checkedChildren={<CheckOutlined />}
                        unCheckedChildren={<UnorderedListOutlined />}
                        onChange={(checked) =>
                          handleAction(() => adminApi.publishTest(test.id, { published: checked }, token))
                        }
                      />
                    </Space>,
                    <Button key="edit" className="action-analysis-btn" icon={<EditOutlined />} onClick={() => startEditTest(test.id)}>
                      Testni ochish
                    </Button>,
                    isAdmin && (
                      <Popconfirm
                      key="delete"
                      title="Test o‘chirilsinmi?"
                      onConfirm={() => handleAction(() => adminApi.deleteTest(test.id, token))}
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        O'chirish
                      </Button>
                                          </Popconfirm>
                    )
                  ]}
                >
                  <List.Item.Meta title={test.title} description={`${test.time_limit_minutes} minut`} />
                </List.Item>
              )}
            />
            </div>
          </Card>
        </Space>
      )
    },
    ...(isAdmin
      ? [
          {
            key: 'teachers',
            label: 'Ustozlar',
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card title={editingTeacherId ? "Ustozni tahrirlash" : "Ustoz qo'shish"} className="elevated-card">
                  <Row gutter={12}>
                    <Col xs={24} md={8}>
                      <Input
                        placeholder="Ism familiya"
                        value={teacherForm.fullName}
                        onChange={(event) => setTeacherForm((prev) => ({ ...prev, fullName: event.target.value }))}
                        autoComplete="off"
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <Input
                        placeholder="Login"
                        value={teacherForm.username}
                        onChange={(event) => setTeacherForm((prev) => ({ ...prev, username: event.target.value }))}
                        autoComplete="new-password"
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder={teacherForm.directionId ? "Mavzu tanlang" : "Avval yo'nalish tanlang"}
                        options={teacherTopicOptions}
                        value={teacherForm.subjectName || undefined}
                        onChange={(value) => setTeacherForm((prev) => ({ ...prev, subjectName: value || '' }))}
                        style={{ width: '100%' }}
                        disabled={!teacherForm.facultyId || !teacherForm.directionId}
                      />
                    </Col>
                  </Row>

                  <Row gutter={12} style={{ marginTop: 12 }}>
                    <Col xs={24} md={8}>
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Fakultet tanlang"
                        options={facultyOptions}
                        value={teacherForm.facultyId || undefined}
                        onChange={(value) =>
                          setTeacherForm((prev) => ({
                            ...prev,
                            facultyId: value || '',
                            directionId: '',
                            subjectName: ''
                          }))
                        }
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Yo'nalish tanlang"
                        options={teacherDirectionOptions}
                        value={teacherForm.directionId || undefined}
                        onChange={(value) =>
                          setTeacherForm((prev) => ({
                            ...prev,
                            directionId: value || '',
                            subjectName: ''
                          }))
                        }
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <Input.Password
                        placeholder={editingTeacherId ? "Yangi parol (ixtiyoriy)" : 'Parol'}
                        value={teacherForm.password}
                        onChange={(event) => setTeacherForm((prev) => ({ ...prev, password: event.target.value }))}
                        autoComplete="new-password"
                      />
                    </Col>
                  </Row>

                  <Space style={{ marginTop: 12 }}>
                    <Button type="primary" icon={editingTeacherId ? <SaveOutlined /> : <PlusOutlined />} onClick={saveTeacherForm}>
                      {editingTeacherId ? 'Yangilash' : "Ustoz qo'shish"}
                    </Button>
                    {editingTeacherId && <Button className="action-muted-btn" onClick={resetTeacherForm}>Bekor qilish</Button>}
                  </Space>
                </Card>

                <Card className="elevated-card" title={`Ustozlar ro'yxati (${teachers.length})`} bodyStyle={{ padding: 0 }}>
                  <div style={{ maxHeight: 360, overflowY: 'auto', padding: 16 }}>
                    <List
                      dataSource={teachers}
                      locale={{ emptyText: <Empty description="Ustozlar yo'q" /> }}
                      renderItem={(teacher) => (
                        <List.Item
                          actions={[
                            <Button key="edit" className="action-edit-btn" icon={<EditOutlined />} onClick={() => startEditTeacher(teacher)}>
                              Tahrirlash
                            </Button>,
                            isAdmin && (
                              <Popconfirm
                              key="delete"
                              title="Ustoz o'chirilsinmi?"
                              onConfirm={() => handleAction(() => adminApi.deleteTeacher(teacher.id, token))}
                            >
                              <Button danger icon={<DeleteOutlined />}>
                                O'chirish
                              </Button>
                                                          </Popconfirm>
                            )
                          ]}
                        >
                          <Space direction="vertical" size={4}>
                            <Text style={{ color: '#fff' }}>{teacher.full_name || teacher.username}</Text>
                            <Text style={{ color: '#94a3b8' }}>Login: {teacher.username}</Text>
                            <Space wrap size={[8, 8]}>
                              <Tag color="blue">{teacher.subject_name || "Fan kiritilmagan"}</Tag>
                              <Tag color="cyan">
                                {faculties.find((faculty) => faculty.id === teacher.faculty_id)?.name || "Noma'lum fakultet"}
                              </Tag>
                              <Tag color="geekblue">
                                {directions.find((direction) => direction.id === teacher.direction_id)?.name || "Noma'lum yo'nalish"}
                              </Tag>
                            </Space>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </div>
                </Card>
              </Space>
            )
          }
        ]
      : []),
    {
      key: 'students',
      label: 'Talabalar',
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Card title="Talabalar CSV boshqaruvi" className="elevated-card">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Button className="action-create-btn" icon={<UploadOutlined />} onClick={openStudentCsvPicker} loading={studentCsvImporting}>
                  CSV import
                </Button>
                <Button className="action-analysis-btn" icon={<DownloadOutlined />} onClick={exportStudentsCsv}>
                  CSV export
                </Button>
                <Button className="action-muted-btn" icon={<FileTextOutlined />} onClick={downloadStudentTemplate}>
                  Namuna CSV
                </Button>
              </Space>

              <Text style={{ color: '#94a3b8' }}>
                {context.directionId
                  ? "Import qilingan talabalar tanlangan yo'nalishga biriktiriladi."
                  : context.facultyId
                    ? "Import qilingan talabalar tanlangan fakultetga biriktiriladi."
                    : "Agar umumiy tanlash bo'sh bo'lsa, talabalar fakultet va yo'nalishsiz yaratiladi."}
              </Text>

              {studentCsvAlert ? <Alert type={studentCsvAlert.type} showIcon message={studentCsvAlert.message} /> : null}
            </Space>
          </Card>

          <Card title="Talabalarni qidirish (Guruh yoki Ism bo'yicha)" className="elevated-card">
            <Input
              placeholder="Qidiruv: qaysi guruh yoki ism?"
              value={studentSearchUrl}
              onChange={(e) => setStudentSearchUrl(e.target.value)}
              size="large"
              style={{ background: 'rgba(15, 23, 42, 0.8)', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </Card>
          <Card className="elevated-card" title={`Talabalar ro'yxati (${filteredStudents.length})`} bodyStyle={{ padding: 0 }}>
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: 16 }}>
            <List
              dataSource={filteredStudents}
              locale={{ emptyText: <Empty description="Talabalar topilmadi" /> }}
              renderItem={(student) => {
                const identity = parseStudentFullName(student.full_name);
                const stats = student.stats || {};
                const attempts = Array.isArray(student.attempts) ? student.attempts : [];
                const isExpanded = expandedStudentId === student.id;

                return (
                  <List.Item
                    actions={[
                      <Button
                        key="toggle"
                        type={isExpanded ? 'default' : 'primary'}
                        className={isExpanded ? 'action-muted-btn' : undefined}
                        onClick={() =>
                          setExpandedStudentId((prev) => (prev === student.id ? '' : student.id))
                        }
                      >
                        {isExpanded ? "Yopish" : "Ko'rish"}
                      </Button>,
                      <Button key="edit" className="action-edit-btn" icon={<EditOutlined />} onClick={() => editStudent(student)}>
                        Tahrirlash
                      </Button>,
                      ...(isAdmin
                        ? [
                            <Popconfirm
                              key="delete"
                              title="Talaba o'chirilsinmi?"
                              onConfirm={() => handleAction(() => adminApi.deleteStudent(student.id, token))}
                            >
                              <Button danger icon={<DeleteOutlined />}>
                                O'chirish
                              </Button>
                            </Popconfirm>
                          ]
                        : [])
                    ]}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <List.Item.Meta
                        title={
                          <Space wrap>
                            <Text style={{ color: '#fff' }}>{identity.displayName || student.username}</Text>
                            <Tag color="cyan">Guruh: {identity.groupName}</Tag>
                          </Space>
                        }
                        description={<Text style={{ color: '#cbd5e1' }}>Login: {student.username}</Text>}
                      />

                      <Space wrap size={[8, 8]}>
                        <Tag color="blue">Urinishlar: {stats.attemptsCount || 0}</Tag>
                        <Tag color="geekblue">Yechilgan testlar: {stats.solvedTestsCount || 0}</Tag>
                        <Tag color="purple">Yakunlangan: {stats.submittedCount || 0}</Tag>
                      </Space>

                      {isExpanded && (
                        <>
                          <Space wrap size={[8, 8]}>
                            <Tag color="green">
                              O'rtacha ball: {typeof stats.averageScore === 'number' ? stats.averageScore : '-'}
                            </Tag>
                            <Tag color="gold">
                              Eng yaxshi ball: {typeof stats.bestScore === 'number' ? stats.bestScore : '-'}
                            </Tag>
                          </Space>

                          {student.lastAttempt ? (
                            <Text style={{ color: '#cbd5e1' }}>
                              Oxirgi test: {student.lastAttempt.testTitle || "Noma'lum test"} |{' '}
                              {formatAttemptStatus(student.lastAttempt.status)} | Ball:{' '}
                              {typeof student.lastAttempt.score === 'number' ? student.lastAttempt.score : '-'}
                              {student.lastAttempt.totalQuestions ? ` / ${student.lastAttempt.totalQuestions}` : ''} |{' '}
                              {formatDateTime(student.lastAttempt.submittedAt || student.lastAttempt.startedAt)}
                            </Text>
                          ) : (
                            <Text style={{ color: '#94a3b8' }}>Bu talaba hali test yechmagan.</Text>
                          )}

                          {attempts.length > 0 && (
                            <div style={{ padding: 10, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                              <Text style={{ color: '#e2e8f0', display: 'block', marginBottom: 6 }}>
                                So'nggi testlar:
                              </Text>
                              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                {attempts.slice(0, 5).map((attempt, index) => (
                                  <Text key={attempt.id} style={{ color: '#cbd5e1' }}>
                                    {index + 1}. {attempt.testTitle || "Noma'lum test"} | {formatAttemptStatus(attempt.status)} | Ball:{' '}
                                    {typeof attempt.score === 'number' ? attempt.score : '-'}
                                    {attempt.totalQuestions ? ` / ${attempt.totalQuestions}` : ''} |{' '}
                                    {formatDateTime(attempt.submittedAt || attempt.startedAt)}
                                  </Text>
                                ))}
                              </Space>
                            </div>
                          )}
                        </>
                      )}
                    </Space>
                  </List.Item>
                );
              }}
            />
            </div>
          </Card>
        </Space>
      )
    }
  ];

  return (
    <PageShell
      title={isTeacher ? 'Ustoz Paneli' : "Boshqaruv paneli"}
      subtitle={
        isTeacher
          ? `${user?.subjectName || "Fan ko'rsatilmagan"} | O'z yo'nalishingiz bo'yicha ko'rish`
          : null
      }
    >
      {loading ? (
        <div className="center-block">
          <Spin size="large" />
        </div>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {error && <Alert type="error" showIcon message={error} />}
          {refreshing && <Text style={{ color: '#93c5fd' }}>Ma'lumotlar yangilanmoqda...</Text>}

          <Card className="elevated-card" title="Umumiy tanlash (bitta joydan)">
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={18}>
                <Cascader
                  allowClear
                  showSearch
                  options={fullTreeOptions}
                  value={contextValue}
                  changeOnSelect
                  placeholder="Fakultet / Yo‘nalish / Mavzuni bir joydan tanlang"
                  onChange={handleContextChange}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} md={6}>
                <Space wrap>
                  {context.facultyId && <Tag color="blue">Fakultet tanlandi</Tag>}
                  {context.directionId && <Tag color="cyan">Yo‘nalish tanlandi</Tag>}
                  {context.topicId && <Tag color="geekblue">Mavzu tanlandi</Tag>}
                </Space>
              </Col>
            </Row>
          </Card>

          <Tabs items={tabItems} />
        </Space>
      )}

      <input
        ref={studentCsvInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleStudentCsvImport}
      />

      <Modal
        open={studentEditModalOpen}
        onCancel={() => closeStudentEditModal()}
        onOk={submitStudentEdit}
        confirmLoading={studentEditSaving}
        okText="Saqlash"
        cancelText="Bekor qilish"
        width={760}
        title={
          editingStudent
            ? `Talabani tahrirlash: ${parseStudentFullName(editingStudent.full_name).displayName || editingStudent.username}`
            : 'Talabani tahrirlash'
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {editingStudent && (
            <Card size="small" style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Space wrap size={[8, 8]}>
                <Tag color="blue">Urinishlar: {editingStudent.stats?.attemptsCount || 0}</Tag>
                <Tag color="purple">Yakunlangan: {editingStudent.stats?.submittedCount || 0}</Tag>
                <Tag color="geekblue">Yechilgan testlar: {editingStudent.stats?.solvedTestsCount || 0}</Tag>
                <Tag color="green">
                  O'rtacha ball: {typeof editingStudent.stats?.averageScore === 'number' ? editingStudent.stats.averageScore : '-'}
                </Tag>
              </Space>
              {editingStudent.lastAttempt && (
                <Text style={{ display: 'block', marginTop: 8, color: '#cbd5e1' }}>
                  Oxirgi test: {editingStudent.lastAttempt.testTitle || "Noma'lum test"} |{' '}
                  {formatAttemptStatus(editingStudent.lastAttempt.status)} |{' '}
                  {formatDateTime(editingStudent.lastAttempt.submittedAt || editingStudent.lastAttempt.startedAt)}
                </Text>
              )}
            </Card>
          )}

          {studentEditError && (
            <Text style={{ color: '#f87171' }}>{studentEditError}</Text>
          )}

          <Form form={studentEditForm} layout="vertical" requiredMark={false}>
            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={<Text style={{ color: '#cbd5e1' }}>Login</Text>}
                  name="username"
                  rules={[{ required: true, message: 'Login kiriting' }, { min: 3, message: 'Kamida 3 ta belgi' }]}
                >
                  <Input placeholder="student_login" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label={<Text style={{ color: '#cbd5e1' }}>Guruh</Text>}
                  name="groupName"
                  rules={[{ required: true, message: 'Guruhni kiriting' }]}
                >
                  <Input placeholder="Masalan: 203" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Form.Item
                  label={<Text style={{ color: '#cbd5e1' }}>Familiya</Text>}
                  name="lastName"
                  rules={[{ required: true, message: 'Familiya kiriting' }]}
                >
                  <Input placeholder="Familiya" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label={<Text style={{ color: '#cbd5e1' }}>Ism</Text>}
                  name="firstName"
                  rules={[{ required: true, message: 'Ism kiriting' }]}
                >
                  <Input placeholder="Ism" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label={<Text style={{ color: '#cbd5e1' }}>Otasining ismi</Text>}
                  name="fatherName"
                  rules={[{ required: true, message: 'Otasining ismini kiriting' }]}
                >
                  <Input placeholder="Otasining ismi" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label={<Text style={{ color: '#cbd5e1' }}>Yangi parol (ixtiyoriy)</Text>}
              name="password"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    if (String(value).length < 4) return Promise.reject(new Error('Parol kamida 4 ta belgi bo‘lsin'));
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input.Password placeholder="Parolni o'zgartirmoqchi bo'lsangiz kiriting" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </PageShell>
  );
}







