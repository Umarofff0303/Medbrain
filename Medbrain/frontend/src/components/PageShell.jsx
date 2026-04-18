import { Avatar, Button, Layout, Modal, Space, Typography } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export function PageShell({ title, subtitle, children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const displayName = user?.fullName || 'Foydalanuvchi';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
  const isAttemptPage = /^\/student\/attempt\/[^/]+$/.test(location.pathname);

  function handleLogoutClick() {
    if (!isAttemptPage) {
      logout();
      return;
    }

    Modal.confirm({
      title: 'Testdan chiqib ketasizmi?',
      content: "Tasdiqlasangiz akkauntdan chiqasiz. Test vaqti hisoblanishda davom etadi.",
      okText: 'Ha, chiqish',
      cancelText: "Yo'q",
      okButtonProps: { danger: true },
      onOk: logout
    });
  }

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img 
            src="/logo.svg" 
            alt="Medbrain Logo" 
            style={{ width: 30, height: 30 }} 
          />
          <Title level={4} className="brand-title" style={{ margin: 0, color: '#fff' }}>
            Medbrain
          </Title>
        </div>

        <Space wrap className="header-right">
          <div className="user-info-minimal" style={{ display: 'flex', alignItems: 'center' }}>
            <Avatar size="small" icon={!initial ? <UserOutlined /> : null} style={{ background: 'rgba(255,255,255,0.08)', marginRight: 8 }}>
              {initial}
            </Avatar>
            <Text className="user-name-text" style={{ color: '#fff', fontSize: '14px' }}>
              {displayName}
            </Text>
          </div>

          <Button className="logout-modern-btn" icon={<LogoutOutlined />} onClick={handleLogoutClick}>
            Chiqish
          </Button>
        </Space>
      </Header>

      <Content className="app-content">
        <div className="app-card-wrap">
          <Title level={3} className="page-title">
            {title}
          </Title>
          {subtitle ? (
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {subtitle}
            </Text>
          ) : null}
          {children}
        </div>
      </Content>

      <Layout.Footer className="app-footer">
        <Space direction="vertical" align="center" style={{ width: '100%' }}>
          <Text style={{ color: '#64748b', fontSize: '13px' }}>
            © 2026 Medbrain Test Platform. Barcha huquqlar himoyalangan.
          </Text>
          <Space size={16}>
             <Text type="secondary" style={{ fontSize: '12px', cursor: 'pointer' }}>Maxfiylik siyosati</Text>
             <Text type="secondary" style={{ fontSize: '12px', cursor: 'pointer' }}>Yordam</Text>
          </Space>
        </Space>
      </Layout.Footer>
    </Layout>
  );
}
