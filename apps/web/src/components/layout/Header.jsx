import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import styles from './Header.module.css';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // 로그인 상태 확인
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');

    if (token && user) {
      const userData = JSON.parse(user);
      console.log('현재 로그인된 사용자:', userData);
    }

    setIsLoggedIn(!!token);
  }, [location]);

  // 현재 활성 메뉴 확인
  const isActiveMenu = (menu) => {
    // 로그인하지 않은 상태에서는 활성 메뉴 표시 안 함
    if (!isLoggedIn) {
      return false;
    }

    const path = location.pathname;

    switch(menu) {
      case '채팅':
        return path === '/' || path.startsWith('/chat');
      case '카카오톡 업로드':
        return path === '/upload';
      case '내 말투 설정':
        return path === '/settings/style-profile';
      case '설정':
        return path === '/settings' && path !== '/settings/style-profile';
      default:
        return false;
    }
  };

  const handleAuthClick = () => {
    if (isLoggedIn) {
      // 로그아웃
      const userName = JSON.parse(localStorage.getItem('user') || '{}').name ||
                       JSON.parse(localStorage.getItem('user') || '{}').username ||
                       '사용자';

      localStorage.clear();
      setIsLoggedIn(false);

      alert(`${userName}님, 로그아웃되었습니다.`);

      // 페이지 리로드하여 완전히 초기화
      window.location.href = '/';
    } else {
      // 로그인 페이지로 이동
      navigate('/login');
    }
  };

  const handleNavClick = (menu) => {
    // 로그인 확인
    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('로그인이 필요한 기능입니다');
      navigate('/login');
      return;
    }

    console.log(`${menu} 클릭됨`);

    switch(menu) {
      case '채팅':
        navigate('/');
        break;
      case '카카오톡 업로드':
        navigate('/upload');
        break;
      case '내 말투 설정':
        navigate('/settings/style-profile');
        break;
      case '설정':
        navigate('/settings');
        break;
      default:
        break;
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.logo} onClick={() => navigate('/')}>
        <span className={styles.logoIcon}>💬</span>
        <h1 className={styles.logoText}>LikemeLikeMe</h1>
      </div>

      <nav className={styles.nav}>
        <button
          className={`${styles.navButton} ${isActiveMenu('채팅') ? styles.navButtonActive : ''}`}
          onClick={() => handleNavClick('채팅')}
        >
          채팅
        </button>
        <button
          className={`${styles.navButton} ${isActiveMenu('카카오톡 업로드') ? styles.navButtonActive : ''}`}
          onClick={() => handleNavClick('카카오톡 업로드')}
        >
          카카오톡 업로드
        </button>
        <button
          className={`${styles.navButton} ${isActiveMenu('내 말투 설정') ? styles.navButtonActive : ''}`}
          onClick={() => handleNavClick('내 말투 설정')}
        >
          내 말투 설정
        </button>
        <button
          className={`${styles.navButton} ${isActiveMenu('설정') ? styles.navButtonActive : ''}`}
          onClick={() => handleNavClick('설정')}
        >
          설정
        </button>
      </nav>

      <button className={styles.logoutButton} onClick={handleAuthClick}>
        {isLoggedIn ? '로그아웃' : '로그인'}
      </button>
    </header>
  );
};

export default Header;
