import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RobotOutlined,
  SendOutlined
} from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';
import { useAuth } from '../../context/useAuth';
import { studentApi } from '../../lib/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// Qattiq keyword-filter olib tashlandi: savolni qabul qilish/cheklashni AI system prompt kontekst asosida hal qiladi.

async function callAI(systemPrompt, userMessage, history = []) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const isGroqValid = apiKey && apiKey !== 'your_groq_api_key_here' && apiKey.length > 20;

  try {
    if (isGroqValid) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content || h.text })),
        { role: 'user', content: userMessage }
      ];

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Groq error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } else {
      // Pollinations AI - Anonymous GET method (Strictly followed based on their notice)
      // To avoid 414 URI Too Long, we must truncate and clean the prompt
      let fullPrompt = `${systemPrompt}\n\n`;
      
      // History (last 3 messages only for context)
      const recentHistory = history.slice(-3);
      recentHistory.forEach(h => {
        fullPrompt += `${h.role === 'user' ? 'Talaba' : 'AI'}: ${h.content || h.text}\n`;
      });
      
      fullPrompt += `Talaba: ${userMessage}`;

      // Max 2000 chars for safety
      const safePrompt = fullPrompt.substring(0, 1800);
      
      const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(safePrompt)}?model=openai&cache=false`);

      if (!response.ok) {
        throw new Error(`AI xizmati vaqtincha band: ${response.status}`);
      }

      const text = await response.text();
      // If the response is the deprecation notice itself, it's a fail
      if (text.includes("Pollinations legacy text API")) {
         throw new Error("AI xizmati yangilanmoqda. Iltimos, Groq API kalitini kiriting.");
      }
      return text;
    }
  } catch (error) {
    console.error('AI Call Error:', error);
    throw new Error("AI bilan bog'lanishda muammo: " + error.message);
  }
}

function formatOptionWithText(optionKey, options) {
  if (!optionKey) return '-';

  const normalizedKey = String(optionKey).toUpperCase();
  const optionText = options?.[normalizedKey];

  if (!optionText) {
    return normalizedKey;
  }

  return `${normalizedKey}. ${optionText}`;
}

function sanitizeAiText(rawText = '') {
  return String(rawText)
    .replace(/\r\n/g, '\n')
    .replace(/\*\*/g, '')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/\bzaif mavzular?\b/gi, "e'tibor berish kerak bo'lgan mavzular")
    .trim();
}

function buildAutoQuestionMessage(answer) {
  return [
    `${answer.orderNo}. ${answer.question}`,
    `Men tanlagan javob: ${formatOptionWithText(answer.selectedOption, answer.options)}`,
    `To'g'ri javob: ${formatOptionWithText(answer.correctOption, answer.options)}`,
    "Iltimos, xatoyimni sodda va aniq tushuntirib bering hamda shu turdagi savollarni qanday yechishni ko'rsating."
  ].join('\n');
}

// AI tahlil componentasi
function AiAnalysisPanel({ result, answers, testTitle, compact = false, mode = 'both', autoChatRequest = null }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [chatError, setChatError] = useState('');
  const chatEndRef = useRef(null);
  const handledAutoRequestRef = useRef(0);
  const showAnalysis = mode === 'both' || mode === 'analysis';
  const showChat = mode === 'both' || mode === 'chat';

  // Xato javoblar ro'yxati
  const wrongAnswers = answers.filter((a) => !a.isCorrect);

  // Xato savollar bo'yicha tuzilgan tahlil matni (Gemini uchun kontekst)
  const buildContext = () => {
    const wrongList = wrongAnswers
      .map(
        (a) =>
          `- Savol: "${a.question}" | Siz: "${formatOptionWithText(a.selectedOption, a.options)}" | To'g'ri: "${formatOptionWithText(a.correctOption, a.options)}"`
      )
      .join('\n');

    return `
Test nomi: ${testTitle}
Umumiy natija: ${result.score}%
To'g'ri javoblar: ${result.correctCount}
Noto'g'ri javoblar: ${result.incorrectCount}

Noto'g'ri javoblar ro'yxati:
${wrongList || 'Barcha javoblar to\'g\'ri!'}
    `.trim();
  };

  // Avtomatik tahlil
  useEffect(() => {
    if (!showAnalysis) return;

    async function runAnalysis() {
      if (answers.length === 0) return;
      setAnalysisLoading(true);
      setAnalysisError('');

      const context = buildContext();
      const systemPrompt = `Sen MedBrain platformasining tibbiy AI yordamchisisisan. Sening vazifang faqat tibbiyot va sog'liqni saqlash sohasidagi savollarga javob berishdir.

Senga talabaning test natijalari berilgan. Shu natijalar asosida:
1. Noto'g'ri javoblardagi xatolarni aniqlash
2. Har bir xato javob bo'yicha qisqa va aniq tushuntirish berish
3. Qayta tayyorlanishda e'tibor berish kerak bo'lgan mavzularni tavsiya qilish

Test ma'lumotlari:
${context}

Javobingni o'zbek tilida, qulay va tushunarli tarzda yoz. "zaif mavzular" iborasini ishlatma va markdown belgilaridan foydalanma.`;

      try {
        const analysisResult = await callAI(systemPrompt, "Senga yuborilgan ma'lumotlar asosida tahlil natijasini yozing.");
        setAnalysisText(sanitizeAiText(analysisResult));
      } catch (err) {
        setAnalysisError(err.message);
      } finally {
        setAnalysisLoading(false);
      }
    }

    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnalysis]);

  // Chat xabari yuborish
  async function sendMessage(messageText, clearInput = true) {
    const trimmed = messageText.trim();
    if (!trimmed || isTyping) return;

    setChatError('');
    const newUserMsg = { role: 'user', text: trimmed };
    const updatedMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedMessages);
    if (clearInput) {
      setInputValue('');
    }
    setIsTyping(true);

    const context = buildContext();
    const systemInstruction = `Sen MedBrain platformasining tajribali shifokor va tibbiy o'qituvchisisan. FAQAT tibbiyot, anatomiya, fiziologiya, patologiya va sog'liqni saqlash mavzularida javob ber.

Talabaning test natijalari va xatolari senga ma'lum:
${context}

Muhim: foydalanuvchi faqat testdan tushgan savollarni emas, keng qamrovdagi tibbiy savollarni ham berishi mumkin. Test natijasini yordamchi kontekst sifatida ishlat, lekin javobni savol mazmuniga mos ber.

Savollarga aniq, ilmiy va talabaga tushunarli tilda javob ber. Agar savol tibbiyotga mutlaqo aloqador bo'lmasa, muloyimlik bilan rad et.`;

    // Groq uchun conversation history
    const recentMessages = updatedMessages.slice(-6);
    const history = [];
    if (recentMessages.length > 1) {
      recentMessages.slice(0, -1).forEach(m => {
        history.push({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text
        });
      });
    }

    try {
      const reply = await callAI(systemInstruction, trimmed, history);
      setChatMessages((prev) => [...prev, { role: 'assistant', text: sanitizeAiText(reply) }]);
    } catch (err) {
      setChatError(err.message);
      setChatMessages((prev) => [...prev, { role: 'assistant', text: 'Javob olishda xato yuz berdi.' }]);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleSend() {
    await sendMessage(inputValue, true);
  }

  useEffect(() => {
    if (!showChat) return;
    if (!autoChatRequest?.id || !autoChatRequest?.message) return;
    if (handledAutoRequestRef.current === autoChatRequest.id) return;
    if (isTyping) return;

    handledAutoRequestRef.current = autoChatRequest.id;
    void sendMessage(autoChatRequest.message, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoChatRequest, isTyping, showChat]);

  // Scroll to bottom when new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  return (
    <div style={{ marginTop: compact ? 0 : 24 }}>
      {showAnalysis ? (
        <Card
          style={{
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            borderRadius: 16,
            marginBottom: showChat ? 16 : 0
          }}
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RobotOutlined style={{ color: '#667eea', fontSize: 18 }} />
              <span style={{ color: '#667eea', fontWeight: 700 }}>AI Tahlil</span>
            </span>
          }
        >
          {analysisLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin size="large" />
              <Paragraph style={{ marginTop: 12, color: '#888' }}>
                AI test natijalaringizni tahlil qilmoqda...
              </Paragraph>
            </div>
          ) : analysisError ? (
            <Alert
              type="warning"
              showIcon
              message={analysisError}
              description="Sun'iy intellekt xizmati vaqtincha ishlamayapti yoki internet tezligingiz past."
            />
          ) : analysisText ? (
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                fontSize: 14,
                color: '#cbd5e1'
              }}
            >
              {analysisText}
            </div>
          ) : null}
        </Card>
      ) : null}

      {showChat ? (
        <Card
          style={{
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(19, 28, 49, 0.6)',
            overflow: 'hidden'
          }}
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RobotOutlined style={{ color: '#52c41a', fontSize: 18 }} />
              <span style={{ fontWeight: 700 }}>AI bilan suhbat</span>
              <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>
                Faqat tibbiyot
              </Tag>
            </span>
          }
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Tibbiy savollarga javob beradi
            </Text>
          }
        >
        {/* Chat xabarlar oynasi */}
        <div
          style={{
            height: 340,
            overflowY: 'auto',
            padding: '8px 4px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 12
          }}
        >
          {chatMessages.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#aaa'
              }}
            >
              <RobotOutlined style={{ fontSize: 48, marginBottom: 12 }} />
              <Text type="secondary">Test bo'yicha savollaringizni bering</Text>
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                Faqat tibbiyotga oid mavzular
              </Text>
            </div>
          ) : (
            chatMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.role === 'user' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}

          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                style={{
                  padding: '10px 16px',
                  borderRadius: '18px 18px 18px 4px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Spin size="small" />
                <Text style={{ color: '#cbd5e1', fontSize: 12 }}>
                  Yozmoqda...
                </Text>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {chatError && (
          <Alert type="error" showIcon message={chatError} style={{ marginBottom: 8 }} closable />
        )}

        {/* Chat input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Tibbiy savol yozing... (Shift+Enter yangi qator)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ flex: 1, borderRadius: 12, background: 'rgba(15, 23, 42, 0.8)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            disabled={isTyping}
          />
          <Button
            type="primary"
            className="action-ai-btn"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={isTyping}
            disabled={!inputValue.trim()}
            style={{
              height: 'auto',
              minHeight: 38
            }}
          >
            Yuborish
          </Button>
        </div>
        </Card>
      ) : null}
    </div>
  );
}

export function ResultPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [isAiAnalysisModalOpen, setIsAiAnalysisModalOpen] = useState(false);
  const [isAiChatModalOpen, setIsAiChatModalOpen] = useState(false);
  const [autoChatRequest, setAutoChatRequest] = useState({ id: 0, message: '' });

  useEffect(() => {
    let cancelled = false;

    async function loadResult() {
      setLoading(true);
      setError('');

      try {
        const response = await studentApi.attemptResult(attemptId, token);
        if (cancelled) return;
        setResult(response.result);
        setAnswers((response.answers || []).sort((a, b) => (a.orderNo || 0) - (b.orderNo || 0)));
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Natijani yuklashda xato.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadResult();

    return () => {
      cancelled = true;
    };
  }, [attemptId, token]);

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/student');
  }

  function handleWrongAnswerClick(answer) {
    if (answer.isCorrect) return;

    const autoMessage = buildAutoQuestionMessage(answer);
    setIsAiChatModalOpen(true);
    setAutoChatRequest((prev) => ({
      id: prev.id + 1,
      message: autoMessage
    }));
  }

  if (loading) {
    return (
      <PageShell title="Natija yuklanmoqda">
        <Card loading />
      </PageShell>
    );
  }

  if (error || !result) {
    return (
      <PageShell title="Natija topilmadi">
        <Alert type="error" showIcon message={error || "Natija yo'q."} />
      </PageShell>
    );
  }

  const isPassed = Number(result.score || 0) >= 60;
  const totalQuestions = Number(result.totalQuestions || answers.length || 0);

  return (
    <PageShell title="Test Natijasi" subtitle={result.testTitle}>
      <Card className="elevated-card" style={{ marginBottom: 14 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8}>
            <Statistic
              title="Umumiy ball"
              value={result.score}
              suffix="%"
              valueStyle={{ fontSize: 28, color: isPassed ? '#22c55e' : '#f59e0b' }}
            />
          </Col>
          <Col xs={24} md={16}>
            <Space wrap size={[8, 8]}>
              <Tag color="success" icon={<CheckCircleOutlined />}>To'g'ri: {result.correctCount}</Tag>
              <Tag color="error" icon={<CloseCircleOutlined />}>Xato: {result.incorrectCount}</Tag>
              <Tag color="blue">Jami: {totalQuestions}</Tag>
              <Tag color={isPassed ? 'green' : 'orange'}>
                {isPassed ? "Testdan o'tdingiz" : "Qayta urinib ko'ring"}
              </Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      <div className="sticky-action-anchor" style={{ marginBottom: 16 }}>
        <div className="sticky-action-bar">
          <Row justify="space-between" align="middle" gutter={[8, 8]}>
            <Col>
              <Button type="default" className="selection-back-btn" icon={<ArrowLeftOutlined />} onClick={handleBack}>
                Orqaga
              </Button>
            </Col>
            <Col>
              <Space wrap size={[8, 8]}>
                <Tag color="success">To'g'ri: {result.correctCount}</Tag>
                <Tag color="error">Xato: {result.incorrectCount}</Tag>
              </Space>
            </Col>
          </Row>
        </div>
      </div>

      <Card title="Javoblar bo'yicha tahlil">
        {answers.length === 0 ? (
          <Empty description="Javoblar topilmadi" />
        ) : (
          <div style={{ maxHeight: 460, overflowY: 'auto', paddingRight: 6 }}>
            <List
              dataSource={answers}
              renderItem={(answer) => (
                <List.Item style={{ padding: 0, borderBottom: 'none' }}>
                  <div
                    role={answer.isCorrect ? undefined : 'button'}
                    tabIndex={answer.isCorrect ? undefined : 0}
                    onClick={answer.isCorrect ? undefined : () => handleWrongAnswerClick(answer)}
                    onKeyDown={
                      answer.isCorrect
                        ? undefined
                        : (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleWrongAnswerClick(answer);
                            }
                          }
                    }
                    style={{
                      width: '100%',
                      padding: '10px 8px',
                      borderRadius: 12,
                      marginBottom: 8,
                      cursor: answer.isCorrect ? 'default' : 'pointer',
                      border: answer.isCorrect ? '1px solid transparent' : '1px solid rgba(239, 68, 68, 0.35)',
                      background: answer.isCorrect ? 'transparent' : 'rgba(239, 68, 68, 0.08)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Descriptions
                      title={`${answer.orderNo}. ${answer.question}`}
                      column={1}
                      size="small"
                      extra={
                        <Space size={8}>
                          {answer.isCorrect ? (
                            <Tag color="success">To'g'ri</Tag>
                          ) : (
                            <Tag color="error">Noto'g'ri</Tag>
                          )}
                          {!answer.isCorrect ? (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Bosilsa AI chatga yuboriladi
                            </Text>
                          ) : null}
                        </Space>
                      }
                    >
                      <Descriptions.Item label="Siz tanlagan">
                        {formatOptionWithText(answer.selectedOption, answer.options)}
                      </Descriptions.Item>
                      <Descriptions.Item label="To'g'ri javob">
                        {formatOptionWithText(answer.correctOption, answer.options)}
                      </Descriptions.Item>
                    </Descriptions>
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}
      </Card>

      <div
        style={{
          position: 'fixed',
          right: 18,
          bottom: 20,
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        <Button
          type="primary"
          className="action-ai-btn"
          onClick={() => setIsAiChatModalOpen(true)}
          icon={<img src="/gemini.svg" alt="Gemini" style={{ width: 16, height: 16 }} />}
        >
          AI suhbat
        </Button>
        <Button
          className="action-analysis-btn"
          onClick={() => setIsAiAnalysisModalOpen(true)}
          icon={<RobotOutlined />}
        >
          AI tahlil
        </Button>
      </div>

      <Modal
        open={isAiChatModalOpen}
        onCancel={() => setIsAiChatModalOpen(false)}
        footer={null}
        width={960}
        destroyOnClose={false}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <img src="/gemini.svg" alt="Gemini" style={{ width: 18, height: 18 }} />
            Gemini AI suhbat
          </span>
        }
        styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingTop: 8 } }}
      >
        <AiAnalysisPanel
          result={result}
          answers={answers}
          testTitle={result.testTitle || 'Test'}
          compact
          mode="chat"
          autoChatRequest={autoChatRequest}
        />
      </Modal>

      <Modal
        open={isAiAnalysisModalOpen}
        onCancel={() => setIsAiAnalysisModalOpen(false)}
        footer={null}
        width={900}
        destroyOnClose={false}
        title="AI tahlil"
        styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingTop: 8 } }}
      >
        <AiAnalysisPanel
          result={result}
          answers={answers}
          testTitle={result.testTitle || 'Test'}
          compact
          mode="analysis"
        />
      </Modal>
    </PageShell>
  );
}

