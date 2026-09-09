import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(formData.email) && formData.password.length > 0;
    setIsFormValid(isValid);
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      newErrors.email = '올바른 이메일 주소를 입력해주세요';
    }

    if (!formData.password) {
      newErrors.password = '비밀번호를 입력해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // 로그인 전 기존 토큰 완전 삭제
      console.log('로그인 시도:', formData.email);
      console.log('기존 localStorage 정리 중...');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        }),
      });

      const data = await response.json();
      console.log('로그인 응답:', data);

      if (!response.ok) {
        if (response.status === 401) {
          setErrors({ general: '이메일 또는 비밀번호가 올바르지 않습니다' });
        } else {
          setErrors({ general: data.message || '로그인에 실패했습니다' });
        }
        return;
      }

      // 새 토큰 저장
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      console.log('새 토큰 저장 완료:', {
        user: data.user,
        access_token_length: data.access_token?.length,
        refresh_token_length: data.refresh_token?.length
      });

      // 환영 메시지
      const userName = data.user.name || data.user.username || '사용자';
      alert(`환영합니다 ${userName}님!`);

      // 메인페이지로 이동
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ general: '네트워크 오류가 발생했습니다' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <button
          className={styles.closeButton}
          onClick={() => navigate('/')}
          aria-label="닫기"
        >
          ✕
        </button>
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>💬</span>
            <h1 className={styles.logoText}>LikemeLikeMe</h1>
          </div>
          <h2 className={styles.title}>로그인</h2>
          <p className={styles.subtitle}>
            답장하기 어려운 순간에는 LikemeLikeMe와 함께!
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {errors.general && (
            <div className={styles.errorAlert}>{errors.general}</div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              이메일
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="이메일을 입력해주세요"
              className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              disabled={isLoading}
            />
            {errors.email && (
              <span className={styles.errorText}>{errors.email}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="password" className={styles.label}>
                비밀번호
              </label>
              <a href="#" className={styles.forgotLink}>
                비밀번호를 잊어버리셨나요?
              </a>
            </div>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력해주세요"
              className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
              disabled={isLoading}
            />
            {errors.password && (
              <span className={styles.errorText}>{errors.password}</span>
            )}
          </div>

          <button
            type="submit"
            className={`${styles.submitButton} ${isFormValid ? styles.submitButtonActive : ''}`}
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : '로그인 하기'}
          </button>
        </form>


        <div className={styles.separator}>
            <span>or</span>
        </div>


        <div className={styles.footer}>
          <p className={styles.footerText}>
            계정이 없으신가요?
          </p>
          <Link to="/signup" className={styles.link}>
            계정 만들기
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
