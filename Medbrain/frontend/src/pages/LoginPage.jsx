import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const { Title, Text } = Typography;

function resolveHomePath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  return '/student';
}

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role, login, register, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login');

  if (isAuthenticated) {
    return (
      <div
        className="auth-layout"
        style={{
          background: 'linear-gradient(to bottom right, #0f172a, #1e1b4b, #000)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Card
          bordered={false}
          style={{
            width: 360,
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 16
          }}
        >
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              Siz allaqachon tizimga kirgansiz
            </Title>
            <Text style={{ color: '#cbd5e1' }}>
              Joriy rol: <b>{role || 'nomaʼlum'}</b>
            </Text>

            <Button type="primary" block onClick={() => navigate(resolveHomePath(role), { replace: true })}>
              Panelga o‘tish
            </Button>
            <Button className="action-muted-btn" block onClick={logout}>
              Boshqa akkauntga kirish
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  async function handleSubmit(values) {
    if (mode === 'register' && values.password !== values.confirmPassword) {
      setError('Parol tasdiqi mos emas.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user =
        mode === 'register'
          ? await register({
              username: values.username,
              password: values.password,
              fullName: values.fullName
            })
          : await login(values);

      navigate(resolveHomePath(user.role), { replace: true });
    } catch (submitError) {
      setError(submitError.message || "Kirish / ro'yxatdan o'tishda xato.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout" style={{ background: 'linear-gradient(to bottom right, #0f172a, #1e1b4b, #000)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card className="auth-card-modern" bordered={false} style={{ width: 340, background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16 }}>
        <Space direction="vertical" size={2}>
          <Title level={3} style={{ color: '#fff', marginBottom: 0 }}>
            Medbrain
          </Title>
          <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
            {mode === 'register' ? "Talaba sifatida ro'yxatdan o'ting" : 'Tizimga kiring'}
          </Text>
        </Space>

        <Space.Compact style={{ width: '100%', marginTop: 16, marginBottom: 8 }}>
          <Button
            type={mode === 'login' ? 'primary' : 'default'}
            block
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Kirish
          </Button>
          <Button
            type={mode === 'register' ? 'primary' : 'default'}
            block
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Ro'yxatdan o'tish
          </Button>
        </Space.Compact>

        <Form layout="vertical" onFinish={handleSubmit}>
          {mode === 'register' && (
            <Form.Item
              name="fullName"
              rules={[{ required: true, message: 'Ism familiyangizni kiriting' }]}
              style={{ marginBottom: 16 }}
            >
              <Input
                size="middle"
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Ism familiya"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.1)'
                }}
              />
            </Form.Item>
          )}

          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Login kiriting' }]}
            style={{ marginBottom: 16 }}
          >
            <Input
              size="middle"
              prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Login"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </Form.Item>

          {mode === 'register' && (
            <Form.Item
              name="confirmPassword"
              rules={[{ required: true, message: 'Parolni tasdiqlang' }]}
              style={{ marginBottom: 16 }}
            >
              <Input.Password
                size="middle"
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Parolni tasdiqlang"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.1)'
                }}
              />
            </Form.Item>
          )}

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Parol kiriting' }]}
            style={{ marginBottom: 16 }}
          >
            <Input.Password
              size="middle"
              prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Parol"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </Form.Item>

          {error && (
            <Form.Item>
              <Alert type="error" showIcon message={error} />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" size="middle" block loading={loading}>
              {mode === 'register' ? "Ro'yxatdan o'tish" : 'Kirish'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
