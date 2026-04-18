import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="center-screen">
      <Result
        status="404"
        title="404"
        subTitle="Sahifa topilmadi"
        extra={
          <Button type="primary" onClick={() => navigate('/login')}>
            Login sahifasiga qaytish
          </Button>
        }
      />
    </div>
  );
}
