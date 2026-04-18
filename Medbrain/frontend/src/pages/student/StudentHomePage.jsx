import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography
} from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, SaveOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';
import { useAuth } from '../../context/useAuth';
import { studentApi } from '../../lib/api';

const { Text, Title } = Typography;

function splitFullName(rawName) {
  if (!rawName) {
    return { groupName: '', firstName: '', lastName: '', fatherName: '' };
  }

  let groupName = '';
  let namePart = String(rawName).trim();

  if (namePart.includes('|')) {
    const splitArr = namePart.split('|');
    groupName = splitArr[0].trim();
    namePart = splitArr.slice(1).join('|').trim();
  }

  const parts = namePart.split(/\s+/).filter(Boolean);

  if (parts.length >= 3) {
    return {
      groupName,
      lastName: parts[0],
      firstName: parts[1],
      fatherName: parts.slice(2).join(' ')
    };
  }

  if (parts.length === 2) {
    return {
      groupName,
      firstName: parts[0],
      lastName: parts[1],
      fatherName: ''
    };
  }

  return {
    groupName,
    firstName: parts[0] || '',
    lastName: '',
    fatherName: ''
  };
}

const MEDICAL_IMAGE_RULES = [
  {
    keywords: ['stomatolog', 'tish', 'karies', 'pulpit', 'periodont', 'gingivit', 'parodont', 'endodont', 'ortodont'],
    prompt: 'close-up dental treatment, healthy teeth anatomy, dentist tools, realistic clinical medical photography'
  },
  {
    keywords: ['pediatri', 'bola', 'chaqaloq', 'child', 'newborn'],
    prompt: 'pediatric doctor caring for a child patient in a clean hospital room, realistic medical photography'
  },
  {
    keywords: ['profilakt', 'epidemiolog', 'vaksin', 'skrining', 'sanitariya', 'gigiyena'],
    prompt: 'preventive medicine consultation, vaccination and health screening, realistic clinical photography'
  },
  {
    keywords: ['biologiya', 'klinik biolog', 'pcr', 'laborator', 'immunolog', 'genetik', 'biokimyo'],
    prompt: 'clinical laboratory diagnostics, blood analysis, microscope and test tubes, realistic medical photography'
  },
  {
    keywords: ['xalq tabobat', 'fitoterapi', 'herbal', 'dori osimlik'],
    prompt: 'traditional medicine with medicinal herbs under physician supervision, realistic medical photography'
  },
  {
    keywords: ['ichki kasallik', 'yurak', 'kardiolog', 'gipertoni', 'miokard', 'pnevmon', 'jigar', 'nefrit'],
    prompt: 'internal medicine doctor examining an adult patient, realistic hospital clinical photography'
  }
];

function normalizeMedicalText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildStableSeed(...parts) {
  const combined = parts.filter(Boolean).join('|');
  let hash = 0;

  for (let index = 0; index < combined.length; index += 1) {
    hash = (hash * 31 + combined.charCodeAt(index)) | 0;
  }

  return Math.abs(hash % 100000);
}

function resolveMedicalImagePrompt({ name, parentName, category }) {
  const normalizedText = normalizeMedicalText(`${name || ''} ${parentName || ''}`);

  for (const rule of MEDICAL_IMAGE_RULES) {
    if (rule.keywords.some((keyword) => normalizedText.includes(normalizeMedicalText(keyword)))) {
      return rule.prompt;
    }
  }

  if (category === 'faculty') {
    return 'medical university faculty building, students in white coats, realistic educational photography';
  }

  if (category === 'direction') {
    return `medical specialty department for ${name}, realistic clinical photography`;
  }

  return `medical education topic about ${name}, realistic clinical photography`;
}

function getDynamicImageUrl({ name, parentName = '', category = 'topic', seedIndex = 0 }) {
  const prompt = resolveMedicalImagePrompt({ name, parentName, category });
  const keyword = encodeURIComponent(`${prompt}, highly detailed, natural colors, no text, no watermark`);
  const stableSeed = buildStableSeed(category, name, parentName, String(seedIndex));

  return `https://image.pollinations.ai/prompt/${keyword}?width=400&height=300&nologo=true&n=1&seed=${stableSeed}`;
}

function getFallbackImageUrl(title) {
  const encodedTitle = encodeURIComponent(title || 'MedBrain');
  return `https://placehold.co/400x300/0b1120/60a5fa?text=${encodedTitle}`;
}

// Oltiburchak (Hexagon) Card componentasi
function HexCard({ title, subtitle, imageUrl, onClick, variant = 'default' }) {
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const fallbackImageUrl = useMemo(() => getFallbackImageUrl(title), [title]);

  useEffect(() => {
    setCurrentImageUrl(imageUrl);
  }, [imageUrl]);

  return (
    <div className={`hex-card variant-${variant}`} onClick={onClick}>
      <div className="hex-card-inner">
        <img
          src={currentImageUrl}
          alt={title}
          className="hex-image"
          onError={() => {
            if (currentImageUrl !== fallbackImageUrl) {
              setCurrentImageUrl(fallbackImageUrl);
            }
          }}
        />
        <div className="hex-glow" />
        <div className="hex-overlay">
          <h3 className="hex-title">{title}</h3>
          {subtitle && <span className="hex-subtitle">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
}

export function StudentHomePage() {
  const navigate = useNavigate();
  const { token, user, updateUser } = useAuth();

  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startLoadingId, setStartLoadingId] = useState('');
  const [selectionSaving, setSelectionSaving] = useState(false);

  const [profileForm, setProfileForm] = useState(() => splitFullName(user?.fullName));
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');

  const [selection, setSelection] = useState({
    facultyId: '',
    directionId: '',
    topicId: ''
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      setError('');

      try {
        const response = await studentApi.catalog(token);
        if (cancelled) return;
        setCatalog(response.catalog || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Katalogni yuklashda xato.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    setProfileForm(splitFullName(user?.fullName));
  }, [user?.fullName]);

  const selectedFaculty = useMemo(
    () => catalog.find((faculty) => faculty.id === selection.facultyId) || null,
    [catalog, selection.facultyId]
  );

  const selectedDirection = useMemo(
    () => selectedFaculty?.directions?.find((direction) => direction.id === selection.directionId) || null,
    [selectedFaculty, selection.directionId]
  );

  const selectedTopic = useMemo(
    () => selectedDirection?.topics?.find((topic) => topic.id === selection.topicId) || null,
    [selectedDirection, selection.topicId]
  );

  useEffect(() => {
    setSelection((prev) => {
      if (prev.facultyId && !selectedFaculty) {
        return { facultyId: '', directionId: '', topicId: '' };
      }

      if (prev.directionId && !selectedDirection) {
        return { ...prev, directionId: '', topicId: '' };
      }

      if (prev.topicId && !selectedTopic) {
        return { ...prev, topicId: '' };
      }

      return prev;
    });
  }, [selectedFaculty, selectedDirection, selectedTopic]);

  async function handleDirectionSelect(directionId) {
    if (!selectedFaculty?.id || selectionSaving) {
      return;
    }

    setSelectionSaving(true);
    setError('');

    try {
      const response = await studentApi.updateSelection(
        {
          facultyId: selectedFaculty.id,
          directionId
        },
        token
      );

      updateUser({
        facultyId: response.user?.facultyId || selectedFaculty.id,
        directionId: response.user?.directionId || directionId
      });

      setSelection((prev) => ({
        ...prev,
        directionId,
        topicId: ''
      }));
    } catch (saveError) {
      setError(saveError.message || "Yo'nalishni saqlashda xato.");
    } finally {
      setSelectionSaving(false);
    }
  }

  async function handleStartTest(testId) {
    setStartLoadingId(testId);

    try {
      const response = await studentApi.startTest(testId, token);
      navigate(`/student/attempt/${response.attempt.id}`);
    } catch (startError) {
      setError(startError.message || 'Testni boshlashda xato.');
    } finally {
      setStartLoadingId('');
    }
  }

  async function handleSaveProfile(values) {
    setProfileError('');
    setProfileMessage('');

    const payload = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      fatherName: values.fatherName.trim(),
      groupName: values.groupName ? values.groupName.trim() : ''
    };

    if (!payload.firstName || !payload.lastName || !payload.fatherName || !payload.groupName) {
      setProfileError('Ism, familiya, va guruh nomi to‘liq kiritilishi kerak.');
      return;
    }

    setProfileLoading(true);

    try {
      const response = await studentApi.updateProfile(payload, token);
      updateUser({ fullName: response.user.fullName });
      setProfileMessage('Student maʼlumotlari saqlandi.');
    } catch (saveError) {
      setProfileError(saveError.message || 'Maʼlumotni saqlashda xato.');
    } finally {
      setProfileLoading(false);
    }
  }

  function renderSelectionStep() {
    if (loading) {
      return (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      );
    }

    // Step 1: Fakultet tanlash
    if (!selection.facultyId) {
      return (
        <div className="student-selection-step">
          <div className="student-step-intro" style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={3} className="glowing-text">Tibbiyot Fakultetlari</Title>
            <Text style={{ color: '#94a3b8' }}>Yo'nalishni tanlash uchun fakultetni tanlang</Text>
          </div>
          
          {catalog.length === 0 ? (
            <Empty description="Fakultetlar mavjud emas" />
          ) : (
            <div className="hex-grid-container">
              {catalog.map((faculty, index) => (
                <HexCard
                  key={faculty.id}
                  title={faculty.name}
                  subtitle="Tibbiyot fakulteti"
                  variant="faculty"
                  imageUrl={getDynamicImageUrl({
                    name: faculty.name,
                    category: 'faculty',
                    seedIndex: index
                  })}
                  onClick={() => setSelection({ facultyId: faculty.id, directionId: '', topicId: '' })}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // Step 2: Yo'nalish tanlash
    if (!selection.directionId) {
      return (
        <div className="student-selection-step">
          <div className="student-step-header" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button 
              type="default"
              size="large"
              className="selection-back-btn"
              icon={<ArrowLeftOutlined />} 
              onClick={() => setSelection({ facultyId: '', directionId: '', topicId: '' })}
            >
              Orqaga
            </Button>
            <div className="student-step-copy">
              <Title level={3} style={{ margin: 0 }} className="glowing-text">Yo'nalishni tanlang</Title>
              <Text style={{ color: '#94a3b8' }}>{selectedFaculty?.name}</Text>
              {selectionSaving && (
                <div>
                  <Text style={{ color: '#60a5fa' }}>Yo'nalish saqlanmoqda...</Text>
                </div>
              )}
            </div>
          </div>
          
          {!(selectedFaculty?.directions?.length) ? (
            <Empty description="Bu fakultetda yo'nalishlar yo'q" />
          ) : (
            <div className="hex-grid-container">
              {selectedFaculty.directions.map((direction, index) => (
                <HexCard
                  key={direction.id}
                  title={direction.name}
                  subtitle={selectedFaculty?.name}
                  variant="faculty-tone"
                  imageUrl={getDynamicImageUrl({
                    name: direction.name,
                    parentName: selectedFaculty?.name,
                    category: 'direction',
                    seedIndex: index * 3
                  })}
                  onClick={() => handleDirectionSelect(direction.id)}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // Step 3: Mavzu tanlash
    if (!selection.topicId) {
      return (
        <div className="student-selection-step">
           <div className="student-step-header" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button 
              type="default"
              size="large"
              className="selection-back-btn"
              icon={<ArrowLeftOutlined />} 
              onClick={() => setSelection({ ...selection, directionId: '', topicId: '' })}
            >
              Orqaga
            </Button>
            <div className="student-step-copy">
              <Title level={3} style={{ margin: 0 }} className="glowing-text">Mavzuni tanlang</Title>
              <Text style={{ color: '#94a3b8' }}>{selectedDirection?.name}</Text>
            </div>
          </div>
          
          {!(selectedDirection?.topics?.length) ? (
            <Empty description="Bu yo'nalishda mavzular yo'q" />
          ) : (
            <div className="hex-grid-container">
              {selectedDirection.topics.map((topic, index) => (
                <HexCard
                  key={topic.id}
                  title={topic.name}
                  subtitle={selectedDirection?.name}
                  variant="faculty-tone"
                  imageUrl={getDynamicImageUrl({
                    name: topic.name,
                    parentName: selectedDirection?.name,
                    category: 'topic',
                    seedIndex: index * 7
                  })}
                  onClick={() => setSelection({ ...selection, topicId: topic.id })}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // Step 4: Testlar ro'yxati
    return (
      <div className="student-selection-step">
        <div className="student-step-header" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button 
            type="default"
            size="large"
            className="selection-back-btn"
            icon={<ArrowLeftOutlined />} 
            onClick={() => setSelection({ ...selection, topicId: '' })}
          >
            Mavzularga qaytish
          </Button>
          <div className="student-step-copy">
            <Title level={3} style={{ margin: 0 }} className="glowing-text">{selectedTopic?.name || 'Mavzu'}</Title>
            <Space wrap className="student-step-meta" style={{ marginTop: 8 }}>
              <Tag color="cyan">{selectedFaculty?.name}</Tag>
              <Tag color="blue">{selectedDirection?.name}</Tag>
            </Space>
          </div>
        </div>

        {!(selectedTopic?.tests?.length) ? (
          <Empty description="Bu mavzu uchun test mavjud emas" />
        ) : (
          <Row className="student-test-grid" gutter={[20, 20]}>
            {selectedTopic.tests.map((test) => (
              <Col xs={24} md={12} lg={8} key={test.id}>
                <Card 
                  className="elevated-card student-test-card" 
                  style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                  bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <div>
                    <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: 8 }}>{test.title}</h3>
                    <Text style={{ color: '#94a3b8' }}>Vaqt chegarasi: {test.timeLimitMinutes} daqiqa</Text>
                  </div>
                  
                  <Button
                    type="primary"
                    className="action-success-btn"
                    icon={<ArrowRightOutlined />}
                    loading={startLoadingId === test.id}
                    onClick={() => handleStartTest(test.id)}
                    style={{ marginTop: 24, width: '100%', height: 42 }}
                  >
                    Testni Boshlash
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>
    );
  }

  return (
    <PageShell title="Boshqaruv Paneli" subtitle="MedBrain zamonaviy ta'lim platformasi">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        {error && <Alert type="error" showIcon message={error} />}

        <div id="profile-form-section">
          <Card 
            className="student-profile-card"
            title={<span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>Profil maʼlumotlari</span>}
            style={{ 
              background: 'rgba(30, 41, 59, 0.45)', 
              backdropFilter: 'blur(16px)', 
              border: 'none', 
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
              borderRadius: '20px',
              padding: '4px'
            }}
          >
            <Form
              layout="vertical"
              onFinish={handleSaveProfile}
              initialValues={profileForm}
              key={user?.fullName || 'student-profile'}
            >
              <Row gutter={12}>
                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={{color: '#94a3b8'}}>Guruh</span>}
                    name="groupName"
                    rules={[{ required: true, message: 'Guruh kiriting' }]}
                  >
                    <Input placeholder="Guruh (Masalan: 202-B)" size="large" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: '#fff' }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={{color: '#94a3b8'}}>Ism</span>}
                    name="firstName"
                    rules={[{ required: true, message: 'Ism kiriting' }]}
                  >
                    <Input placeholder="Ism" size="large" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: '#fff' }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={{color: '#94a3b8'}}>Familiya</span>}
                    name="lastName"
                    rules={[{ required: true, message: 'Familiya kiriting' }]}
                  >
                    <Input placeholder="Familiya" size="large" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: '#fff' }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item
                    label={<span style={{color: '#94a3b8'}}>Otasining ismi</span>}
                    name="fatherName"
                    rules={[{ required: true, message: 'Otasining ismini kiriting' }]}
                  >
                    <Input placeholder="Otasining ismi" size="large" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: '#fff' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Space>
                <Button type="primary" htmlType="submit" loading={profileLoading} icon={<SaveOutlined />} size="large">
                  Ma'lumotlarni Saqlash
                </Button>
                {profileMessage && <Text type="success">{profileMessage}</Text>}
              </Space>
            </Form>

            {profileError && <Alert style={{ marginTop: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }} type="error" showIcon message={<span style={{color: '#fff'}}>{profileError}</span>} />}
          </Card>
        </div>

        <Card 
          className="elevated-card"
          bodyStyle={{ padding: 0 }}
        >
          {/* Dashboard Header Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(15, 23, 42, 0.4) 100%)',
            padding: '24px 32px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 20
          }}>
            <div style={{ flex: 1 }}>
              <Title level={4} style={{ color: '#fff', margin: 0 }}>Tibbiyot bilimingizni tekshirishni boshlang</Title>
              <Text style={{ color: '#94a3b8' }}>Fakultet va yo'nalishni tanlab, testlarga kiring.</Text>
            </div>
          </div>

          <div style={{ padding: 32 }}>
            {renderSelectionStep()}
          </div>
        </Card>


      </Space>
    </PageShell>
  );
}
