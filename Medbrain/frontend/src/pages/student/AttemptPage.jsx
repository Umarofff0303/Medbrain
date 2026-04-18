import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Progress,
  Radio,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography
} from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBeforeUnload, useNavigate, useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';
import { useAuth } from '../../context/useAuth';
import { studentApi } from '../../lib/api';

const { Text } = Typography;

function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export function AttemptPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [testTitle, setTestTitle] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [allowNavigation, setAllowNavigation] = useState(false);

  const autoSubmittedRef = useRef(false);

  const currentQuestion = questions[currentIndex];

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => Boolean(value)).length,
    [answers]
  );
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const shouldBlockNavigation = !allowNavigation && !loading && !submitLoading && remainingSeconds > 0;

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!shouldBlockNavigation) return;
        event.preventDefault();
        event.returnValue = '';
      },
      [shouldBlockNavigation]
    )
  );

  const submitAttempt = useCallback(
    async (autoSubmit = false) => {
      if (submitLoading) return;

      setSubmitLoading(true);
      setError('');

      const payloadAnswers = questions.map((question) => ({
        questionId: question.id,
        selectedOption: answers[question.id] || null
      }));

      try {
        await studentApi.submitAttempt(
          attemptId,
          {
            answers: payloadAnswers,
            autoSubmit
          },
          token
        );
        setAllowNavigation(true);
        navigate(`/student/result/${attemptId}`, { replace: true });
      } catch (submitError) {
        try {
          const latestAttempt = await studentApi.attempt(attemptId, token);
          if (latestAttempt?.attempt?.status && latestAttempt.attempt.status !== 'in_progress') {
            setAllowNavigation(true);
            navigate(`/student/result/${attemptId}`, { replace: true });
            return;
          }
        } catch {
          // no-op: original error message is shown below
        }

        setError(submitError.message || 'Submit xatosi.');
        setSubmitLoading(false);
        autoSubmittedRef.current = false;
        setAllowNavigation(false);
      }
    },
    [answers, attemptId, navigate, questions, submitLoading, token]
  );

  const confirmFinishAttempt = useCallback(() => {
    if (submitLoading) return;

    Modal.confirm({
      title: 'Testni yakunlaysizmi?',
      content:
        unansweredCount > 0
          ? `${unansweredCount} ta savol javobsiz qoladi. Baribir yakunlaysizmi?`
          : "Tasdiqlasangiz javoblar yuboriladi va keyin o'zgartirib bo'lmaydi.",
      okText: 'Ha, yakunlash',
      cancelText: "Yo'q",
      onOk: () => submitAttempt(false)
    });
  }, [submitAttempt, submitLoading, unansweredCount]);

  const confirmExitAttempt = useCallback(() => {
    if (submitLoading) return;

    Modal.confirm({
      title: 'Testdan chiqasizmi?',
      content: "Agar chiqsangiz, test vaqt hisoblagichi to'xtamaydi.",
      okText: 'Ha, chiqaman',
      cancelText: "Yo'q",
      okButtonProps: { danger: true },
      onOk: () => {
        setAllowNavigation(true);
        navigate('/student');
      }
    });
  }, [navigate, submitLoading]);

  useEffect(() => {
    let cancelled = false;

    async function loadAttempt() {
      setLoading(true);
      setError('');

      try {
        const response = await studentApi.attempt(attemptId, token);
        if (cancelled) return;

        if (response.attempt.status !== 'in_progress') {
          navigate(`/student/result/${attemptId}`, { replace: true });
          return;
        }

        setTestTitle(response.test.title);
        setQuestions(response.questions || []);
        setRemainingSeconds(response.attempt.remainingSeconds || 0);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Attemptni yuklashda xato.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAttempt();

    return () => {
      cancelled = true;
    };
  }, [attemptId, navigate, token]);

  useEffect(() => {
    if (loading || submitLoading) return;
    if (remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, remainingSeconds, submitLoading]);

  useEffect(() => {
    if (loading || submitLoading) return;
    if (remainingSeconds > 0) return;
    if (autoSubmittedRef.current) return;

    autoSubmittedRef.current = true;
    void submitAttempt(true);
  }, [loading, remainingSeconds, submitAttempt, submitLoading]);

  if (loading) {
    return (
      <PageShell title="Test yuklanmoqda">
        <div className="center-block">
          <Spin size="large" />
        </div>
      </PageShell>
    );
  }

  if (!currentQuestion) {
    return (
      <PageShell title="Savollar topilmadi">
        <Empty description="Bu testda savol yo‘q" />
      </PageShell>
    );
  }

  return (
    <PageShell title={testTitle} subtitle="Savollarni birma-bir javoblang">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {error && <Alert type="error" showIcon message={error} />}

        <Row justify="start">
          <Button
            danger
            ghost
            className="action-exit-btn"
            onClick={confirmExitAttempt}
          >
            Testdan chiqish
          </Button>
        </Row>

        <Card 
          style={{ 
            background: 'rgba(30, 41, 59, 0.4)', 
            backdropFilter: 'blur(12px)', 
            border: '1px solid rgba(255, 255, 255, 0.05)', 
            borderRadius: '16px' 
          }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Statistic
                title={<span style={{ color: '#94a3b8' }}>Qolgan vaqt</span>}
                value={formatSeconds(remainingSeconds)}
                prefix={<ClockCircleOutlined style={{ color: '#3b82f6' }} />}
                valueStyle={{ color: remainingSeconds <= 60 ? '#ef4444' : '#fff' }}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic 
                title={<span style={{ color: '#94a3b8' }}>Javoblangan</span>} 
                value={`${answeredCount}/${questions.length}`} 
                valueStyle={{ color: '#fff' }}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic 
                title={<span style={{ color: '#94a3b8' }}>Joriy savol</span>} 
                value={`${currentIndex + 1}/${questions.length}`} 
                valueStyle={{ color: '#fff' }}
              />
            </Col>
          </Row>

          <Progress
            style={{ marginTop: 12 }}
            percent={questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}
            status="active"
            strokeColor="#3b82f6"
            trailColor="rgba(255,255,255,0.05)"
          />
        </Card>

        <Card
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px'
          }}
          title={<span style={{ color: '#fff' }}>{currentIndex + 1}-savol</span>}
        >
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Text style={{ color: '#fff', fontSize: '16px', fontWeight: 500 }}>{currentQuestion.text}</Text>

            <Radio.Group
              value={answers[currentQuestion.id] || null}
              onChange={(event) =>
                setAnswers((prev) => ({
                  ...prev,
                  [currentQuestion.id]: event.target.value
                }))
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {Object.entries(currentQuestion.options).map(([key, label]) => (
                  <Radio
                    key={key}
                    value={key}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.05)',
                      marginBottom: '8px'
                    }}
                  >
                    <Text style={{ color: '#cbd5e1' }}>
                      <strong style={{ color: '#3b82f6' }}>{key}.</strong> {label}
                    </Text>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>

            <div className="attempt-inline-nav">
              <Button
                className="action-muted-btn"
                icon={<LeftOutlined />}
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => prev - 1)}
              >
                Orqaga
              </Button>

              <Button
                className="action-muted-btn"
                icon={<RightOutlined />}
                disabled={currentIndex >= questions.length - 1}
                onClick={() => setCurrentIndex((prev) => prev + 1)}
              >
                Keyingi
              </Button>

              <Button
                type="primary"
                className="action-success-btn"
                icon={<CheckCircleOutlined />}
                loading={submitLoading}
                onClick={confirmFinishAttempt}
              >
                Testni tamomlash
              </Button>
            </div>

            {unansweredCount > 0 ? <Tag color="orange">Javobsiz: {unansweredCount}</Tag> : null}
          </Space>
        </Card>
      </Space>
    </PageShell>
  );
}
