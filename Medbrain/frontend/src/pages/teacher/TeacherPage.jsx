import { DownloadOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, List, Select, Space, Spin, Switch, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '../../components/PageShell';
import { useAuth } from '../../context/useAuth';
import { adminApi } from '../../lib/api';
import {
  createStudentImportTemplateCsv,
  createStudentsExportCsv,
  downloadCsvFile,
  parseStudentImportCsv
} from '../../lib/studentCsv';

const { Text, Title } = Typography;

function parseStudentFullName(rawFullName) {
  const raw = String(rawFullName || '').trim();

  if (!raw) {
    return { groupName: "Ko'rsatilmagan", displayName: '' };
  }

  if (!raw.includes('|')) {
    return { groupName: "Ko'rsatilmagan", displayName: raw };
  }

  const [groupPart, ...nameParts] = raw.split('|');
  const groupName = groupPart.trim() || "Ko'rsatilmagan";
  const displayName = nameParts.join('|').trim() || '';

  return { groupName, displayName };
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

export function TeacherPage() {
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tests, setTests] = useState([]);
  const [students, setStudents] = useState([]);

  const [selectedTestId, setSelectedTestId] = useState('');
  const [accessRows, setAccessRows] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [accessSavingKey, setAccessSavingKey] = useState('');
  const [studentCsvAlert, setStudentCsvAlert] = useState(null);
  const [studentCsvImporting, setStudentCsvImporting] = useState(false);
  const studentCsvInputRef = useRef(null);

  async function loadBase() {
    setLoading(true);
    setError('');

    try {
      const [testsResp, studentsResp] = await Promise.all([adminApi.tests(token), adminApi.students(token)]);
      const nextTests = testsResp.tests || [];
      const nextStudents = studentsResp.students || [];

      setTests(nextTests);
      setStudents(nextStudents);

      if (nextTests.length > 0) {
        setSelectedTestId((prev) => (prev && nextTests.some((test) => test.id === prev) ? prev : nextTests[0].id));
      } else {
        setSelectedTestId('');
      }
    } catch (loadError) {
      setError(loadError.message || "Ustoz paneli ma'lumotlarini yuklashda xato.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAccessMatrix(testId) {
    if (!testId) {
      setAccessRows([]);
      return;
    }

    setAccessLoading(true);
    setAccessError('');

    try {
      const response = await adminApi.testAccessMatrix(testId, token);
      setAccessRows(response.students || []);
    } catch (matrixError) {
      setAccessError(matrixError.message || "Ruxsat jadvalini yuklab bo'lmadi.");
      setAccessRows([]);
    } finally {
      setAccessLoading(false);
    }
  }

  useEffect(() => {
    loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    loadAccessMatrix(selectedTestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTestId, token]);

  async function toggleStudentAccess(studentId, allowed) {
    if (!selectedTestId) return;

    const key = `${selectedTestId}:${studentId}`;
    setAccessSavingKey(key);
    setAccessError('');

    try {
      await adminApi.setStudentTestAccess(selectedTestId, studentId, { blocked: !allowed }, token);
      setAccessRows((prev) =>
        prev.map((row) => (row.id === studentId ? { ...row, blocked: !allowed } : row))
      );
    } catch (saveError) {
      setAccessError(saveError.message || "Ruxsat holatini saqlab bo'lmadi.");
    } finally {
      setAccessSavingKey('');
    }
  }

  function openStudentCsvPicker() {
    setStudentCsvAlert(null);
    studentCsvInputRef.current?.click();
  }

  function downloadStudentTemplate() {
    downloadCsvFile('teacher-student-import-template.csv', createStudentImportTemplateCsv());
  }

  function exportStudentsCsv() {
    if (visibleStudents.length === 0) {
      setStudentCsvAlert({ type: 'error', message: 'Export qilish uchun talabalar topilmadi.' });
      return;
    }

    downloadCsvFile('teacher-students.csv', createStudentsExportCsv(visibleStudents));
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
      const response = await adminApi.importStudents({ students: studentsToImport }, token);

      await loadBase();
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

  const testOptions = useMemo(
    () => tests.map((test) => ({ label: `${test.title} (${test.time_limit_minutes} min)`, value: test.id })),
    [tests]
  );
  const selectedTest = useMemo(() => tests.find((test) => test.id === selectedTestId) || null, [tests, selectedTestId]);
  const visibleStudents = useMemo(() => {
    if (students.length > 0) {
      return students;
    }

    return accessRows.map((student) => ({
      ...student,
      stats: {
        attemptsCount: student.attemptsCount || 0,
        submittedCount: student.submittedCount || 0,
        solvedTestsCount: student.solved ? 1 : 0
      },
      lastAttempt: student.latestAttempt
        ? {
            testTitle: selectedTest?.title || "Tanlangan test",
            status: student.latestAttempt.status,
            score: student.latestAttempt.score,
            totalQuestions: student.latestAttempt.totalQuestions,
            submittedAt: student.latestAttempt.submittedAt
          }
        : null
    }));
  }, [accessRows, selectedTest, students]);

  return (
    <PageShell
      title="Ustoz Paneli"
      subtitle={`${user?.subjectName || "Fan ko'rsatilmagan"} | Faqat natijalar va ruxsat boshqaruvi`}
    >
      {loading ? (
        <div className="center-block">
          <Spin size="large" />
        </div>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {error && <Alert type="error" showIcon message={error} />}

          <Card className="elevated-card" title="Qisqacha ma'lumot">
            <Space wrap size={[8, 8]}>
              <Tag color="blue">Fan: {user?.subjectName || '-'}</Tag>
              <Tag color="cyan">Testlar: {tests.length}</Tag>
              <Tag color="geekblue">Talabalar: {visibleStudents.length}</Tag>
            </Space>
          </Card>

          <Card className="elevated-card" title="Talabalar CSV boshqaruvi">
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
                Import qilingan talabalar ustozning o'z fakulteti yoki yo'nalishiga biriktiriladi.
              </Text>

              {studentCsvAlert ? <Alert type={studentCsvAlert.type} showIcon message={studentCsvAlert.message} /> : null}
            </Space>
          </Card>

          <Card className="elevated-card" title="Test bo'yicha ruxsat boshqaruvi">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Test tanlang"
                options={testOptions}
                value={selectedTestId || undefined}
                onChange={(value) => setSelectedTestId(value || '')}
                style={{ width: '100%' }}
              />

              {accessError && <Alert type="error" showIcon message={accessError} />}

              {accessLoading ? (
                <Spin />
              ) : accessRows.length === 0 ? (
                <Empty description={selectedTestId ? "Bu test uchun talabalar topilmadi." : 'Avval test tanlang.'} />
              ) : (
                <List
                  dataSource={accessRows}
                  renderItem={(student) => {
                    const identity = parseStudentFullName(student.full_name);
                    const key = `${selectedTestId}:${student.id}`;

                    return (
                      <List.Item
                        actions={[
                          <Switch
                            key="access"
                            checked={!student.blocked}
                            checkedChildren="Ruxsat"
                            unCheckedChildren="Taqiq"
                            loading={accessSavingKey === key}
                            onChange={(nextAllowed) => toggleStudentAccess(student.id, nextAllowed)}
                          />
                        ]}
                      >
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Space wrap size={[8, 8]}>
                            <Text style={{ color: '#fff' }}>{identity.displayName || student.username}</Text>
                            <Tag color="cyan">Guruh: {identity.groupName}</Tag>
                            <Tag color={student.solved ? 'green' : 'default'}>
                              {student.solved ? 'Yechgan' : 'Yechmagan'}
                            </Tag>
                            <Tag color="blue">Urinishlar: {student.attemptsCount || 0}</Tag>
                          </Space>

                          <Text style={{ color: '#94a3b8' }}>Login: {student.username}</Text>

                          {student.latestAttempt ? (
                            <Text style={{ color: '#cbd5e1' }}>
                              Oxirgi holat: {formatAttemptStatus(student.latestAttempt.status)} | Ball:{' '}
                              {typeof student.latestAttempt.score === 'number' ? student.latestAttempt.score : '-'}
                              {student.latestAttempt.totalQuestions ? ` / ${student.latestAttempt.totalQuestions}` : ''} |{' '}
                              {formatDateTime(student.latestAttempt.submittedAt)}
                            </Text>
                          ) : (
                            <Text style={{ color: '#94a3b8' }}>Hali test ishlanmagan.</Text>
                          )}
                        </Space>
                      </List.Item>
                    );
                  }}
                />
              )}
            </Space>
          </Card>

          <Card className="elevated-card" title="Talabalar natijalari (faqat ko'rish)">
            {visibleStudents.length === 0 ? (
              <Empty description="Talabalar topilmadi." />
            ) : (
              <List
                dataSource={visibleStudents}
                renderItem={(student) => {
                  const identity = parseStudentFullName(student.full_name);
                  const stats = student.stats || {};

                  return (
                    <List.Item>
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        <Space wrap size={[8, 8]}>
                          <Text style={{ color: '#fff' }}>{identity.displayName || student.username}</Text>
                          <Tag color="cyan">Guruh: {identity.groupName}</Tag>
                          <Tag color="blue">Urinishlar: {stats.attemptsCount || 0}</Tag>
                          <Tag color="purple">Yakunlangan: {stats.submittedCount || 0}</Tag>
                          <Tag color="geekblue">Yechilgan testlar: {stats.solvedTestsCount || 0}</Tag>
                          <Tag color="green">O'rtacha ball: {typeof stats.averageScore === 'number' ? stats.averageScore : '-'}</Tag>
                          <Tag color="gold">Eng yaxshi ball: {typeof stats.bestScore === 'number' ? stats.bestScore : '-'}</Tag>
                        </Space>

                        <Text style={{ color: '#94a3b8' }}>Login: {student.username}</Text>

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
                      </Space>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Space>
      )}

      <input
        ref={studentCsvInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleStudentCsvImport}
      />
    </PageShell>
  );
}
