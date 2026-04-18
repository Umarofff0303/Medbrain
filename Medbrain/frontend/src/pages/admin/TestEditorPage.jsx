import {
  Alert,
  Button,
  Card,
  Cascader,
  Checkbox,
  Col,
  Empty,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography
} from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';
import { useAuth } from '../../context/useAuth';
import { adminApi } from '../../lib/api';
import { buildTopicGroups } from '../../lib/topicGroups';
import { isAllowedTopicForScope } from '../../lib/topicPolicy';

const { Text } = Typography;

function emptyQuestion() {
  return {
    text: '',
    options: { A: '', B: '', C: '', D: '' },
    correctOption: 'A'
  };
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

export function TestEditorPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { testId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testForm, setTestForm] = useState({
    title: '',
    topicId: '',
    timeLimitMinutes: 20,
    published: false,
    questions: [emptyQuestion()]
  });

  const [faculties, setFaculties] = useState([]);
  const [directions, setDirections] = useState([]);
  const [topics, setTopics] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError('');
      setSuccess('');

      try {
        const [facultiesResp, directionsResp, topicsResp, testResp] = await Promise.all([
          adminApi.faculties(token),
          adminApi.directions(token),
          adminApi.topics(token),
          adminApi.testById(testId, token)
        ]);

        if (cancelled) {
          return;
        }

        setFaculties(facultiesResp.faculties || []);
        setDirections(directionsResp.directions || []);
        setTopics(topicsResp.topics || []);

        const questions = Array.isArray(testResp.questions) ? testResp.questions : [];

        setTestForm({
          title: testResp.test?.title || '',
          topicId: testResp.test?.topic_id || '',
          timeLimitMinutes: Number(testResp.test?.time_limit_minutes || 20),
          published: Boolean(testResp.test?.published),
          questions: questions.length > 0 ? questions.map((question) => normalizeQuestion(question)) : [emptyQuestion()]
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Testni yuklashda xato.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [testId, token]);

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

  const selectedTopic = useMemo(
    () => visibleTopics.find((topic) => topic.id === testForm.topicId) || topics.find((topic) => topic.id === testForm.topicId) || null,
    [topics, testForm.topicId, visibleTopics]
  );

  const selectedDirection = useMemo(
    () => directions.find((direction) => direction.id === selectedTopic?.direction_id) || null,
    [directions, selectedTopic]
  );

  const selectedFaculty = useMemo(
    () => faculties.find((faculty) => faculty.id === selectedTopic?.faculty_id) || null,
    [faculties, selectedTopic]
  );

  const topicPath = useMemo(() => {
    if (!selectedTopic) {
      return [];
    }

    return [
      selectedTopic.faculty_id,
      selectedTopic.direction_id,
      representativeTopicIdByTopicId.get(String(selectedTopic.id)) || selectedTopic.id
    ];
  }, [representativeTopicIdByTopicId, selectedTopic]);

  async function saveTest() {
    setError('');
    setSuccess('');

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
      setError('Har bir savol va barcha variantlar to‘liq kiritilishi kerak.');
      return;
    }

    const payload = {
      title: testForm.title.trim(),
      topicId: testForm.topicId,
      timeLimitMinutes: Number(testForm.timeLimitMinutes),
      published: Boolean(testForm.published),
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

    setSaving(true);

    try {
      await adminApi.updateTest(testId, payload, token);
      setSuccess("Test ma'lumotlari saqlandi.");
    } catch (saveError) {
      setError(saveError.message || "Testni saqlashda xato.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell title="Test tahlili va tahrirlash" subtitle={testForm.title || "Test yuklanmoqda"}>
      {loading ? (
        <div className="center-block">
          <Spin size="large" />
        </div>
      ) : error && !testForm.title ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert type="error" showIcon message={error} />
          <Button className="selection-back-btn" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin')}>
            Boshqaruv paneliga qaytish
          </Button>
        </Space>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {error && <Alert type="error" showIcon message={error} />}
          {success && <Alert type="success" showIcon message={success} />}

          <Card className="elevated-card">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap size={[8, 8]}>
                <Button className="selection-back-btn" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin')}>
                  Boshqaruv paneliga qaytish
                </Button>
                <Tag color="blue">Savollar: {testForm.questions.length}</Tag>
                <Tag color="cyan">Fakultet: {selectedFaculty?.name || '-'}</Tag>
                <Tag color="geekblue">Yo'nalish: {selectedDirection?.name || '-'}</Tag>
                <Tag color={testForm.published ? 'green' : 'default'}>
                  {testForm.published ? 'Nashr qilingan' : 'Qoralama'}
                </Tag>
              </Space>

              <Row gutter={[12, 12]}>
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
                    value={topicPath}
                    placeholder="Fakultet / Yo'nalish / Mavzuni tanlang"
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
            </Space>
          </Card>

          <Card className="elevated-card" title="Savollar">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div className="sticky-action-bar admin-test-action-bar">
                <Space wrap>
                  <Button
                    className="action-create-btn"
                    icon={<PlusOutlined />}
                    onClick={() =>
                      setTestForm((prev) => ({
                        ...prev,
                        questions: [...prev.questions, emptyQuestion()]
                      }))
                    }
                  >
                    Savol qo'shish
                  </Button>
                  <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={saveTest}>
                    O'zgarishlarni saqlash
                  </Button>
                </Space>
              </div>

              {testForm.questions.length === 0 ? (
                <Empty description="Savollar topilmadi." />
              ) : (
                testForm.questions.map((question, index) => (
                  <Card key={`question-${index}`} size="small" title={`Savol ${index + 1}`}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
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

                      <Row gutter={[8, 8]}>
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
                          style={{ width: 220 }}
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
                ))
              )}
            </Space>
          </Card>
        </Space>
      )}
    </PageShell>
  );
}
