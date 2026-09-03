import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { llmAPI } from '../../api/endpoints/llm';
import Header from '../../components/layout/Header';
import styles from './StyleProfilePage.module.css';

const StyleProfilePage = () => {
  const navigate = useNavigate();
  const [guidelines, setGuidelines] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // 기존 스타일 프로필 불러오기
  useEffect(() => {
    const fetchStyleProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await llmAPI.getStyleProfile();

        if (data && data.custom_guidelines) {
          setGuidelines(data.custom_guidelines);
          console.log('✅ [스타일 프로필] 기존 설정 로드 완료');
        } else {
          console.log('ℹ️ [스타일 프로필] 저장된 설정 없음, 새로 작성 가능');
        }
      } catch (err) {
        console.error('❌ [스타일 프로필] 로드 실패:', err);
        setError('스타일 프로필을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchStyleProfile();
  }, []);

  // 저장하기
  const handleSave = async () => {
    if (!guidelines.trim()) {
      setError('내용을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');

      await llmAPI.saveStyleProfile(guidelines);

      setSuccessMessage('✅ 스타일 프로필이 저장되었습니다!');
      console.log('✅ [스타일 프로필] 저장 완료');

      // 3초 후 성공 메시지 제거
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('❌ [스타일 프로필] 저장 실패:', err);
      setError('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  // 초기화하기
  const handleReset = async () => {
    if (!window.confirm('스타일 프로필을 초기화하시겠습니까? 저장된 내용이 모두 삭제됩니다.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');

      await llmAPI.deleteStyleProfile();

      setGuidelines('');
      setSuccessMessage('✅ 스타일 프로필이 초기화되었습니다.');
      console.log('✅ [스타일 프로필] 초기화 완료');

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('❌ [스타일 프로필] 초기화 실패:', err);
      setError('초기화 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Header />
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>스타일 프로필을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Header />

      <div className={styles.content}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => navigate('/')}>
            ←
          </button>
          <h1 className={styles.title}>내 말투 설정</h1>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>커스텀 가이드라인</h2>
            <p className={styles.cardDescription}>
              AI가 답변을 생성할 때 따라야 할 당신만의 말투 규칙을 작성하세요.
              <br />
              예: "비속어 사용 금지", "이모지 많이 사용", "~습니다 체 사용" 등
            </p>
          </div>

          <div className={styles.cardBody}>
            <textarea
              className={styles.textarea}
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              placeholder={`예시:\n- 비속어와 욕설을 사용하지 않음\n- 느낌표(!)를 거의 사용하지 않음\n- 이모지는 적당히 사용 (과하지 않게)\n- ~습니다 체보다는 ~해요 체 선호\n- 간결하고 명확한 표현 선호`}
              disabled={saving}
            />

            <div className={styles.characterCount}>
              {guidelines.length} / 2000자
            </div>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          {successMessage && (
            <div className={styles.successMessage}>
              {successMessage}
            </div>
          )}

          <div className={styles.cardFooter}>
            <button
              className={styles.resetButton}
              onClick={handleReset}
              disabled={saving || !guidelines.trim()}
            >
              {saving ? '처리 중...' : '초기화'}
            </button>
            <button
              className={styles.saveButton}
              onClick={handleSave}
              disabled={saving || !guidelines.trim()}
            >
              {saving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </div>

        <div className={styles.infoCard}>
          <h3 className={styles.infoTitle}>💡 사용 팁</h3>
          <ul className={styles.infoList}>
            <li>구체적으로 작성할수록 AI가 더 정확하게 따릅니다</li>
            <li>부정적 표현(~하지 않음)과 긍정적 표현(~함) 모두 사용 가능</li>
            <li>줄바꿈과 - (하이픈)을 사용하면 가독성이 좋습니다</li>
            <li>이 설정은 모든 대화에 공통으로 적용됩니다</li>
            <li>개별 관계 설정과 함께 사용하면 더욱 세밀한 조정이 가능합니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StyleProfilePage;
