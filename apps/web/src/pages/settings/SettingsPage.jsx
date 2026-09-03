import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../api/endpoints/user';
import { llmAPI } from '../../api/endpoints/llm';
import Header from '../../components/layout/Header';
import styles from './SettingsPage.module.css';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [styleProfile, setStyleProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');

  // 초기 데이터 로드
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 프로필 정보는 필수
      const profileData = await userAPI.getMyProfile();
      setProfile(profileData);

      // 통계는 404일 경우 기본값 사용
      let statsData = null;
      try {
        statsData = await userAPI.getStats();
        console.log('✅ [설정] 통계 로드 완료:', statsData);
      } catch (err) {
        if (err.response?.status === 404) {
          console.log('ℹ️ [설정] 통계 API 없음 (404), 기본값 사용');
          // 백엔드에서 아직 구현 안 된 경우 기본값
          statsData = {
            conversations: 0,
            totalMessages: 0,
            myMessages: 0,
            toneSamples: 0,
            relationships: 0
          };
        } else {
          console.error('❌ [설정] 통계 조회 중 오류:', err);
        }
      }
      setStats(statsData);

      // 스타일 프로필은 404가 정상일 수 있으므로 별도 처리
      let styleData = null;
      try {
        styleData = await llmAPI.getStyleProfile();
        console.log('✅ [설정] 스타일 프로필 로드 완료');
      } catch (err) {
        // 404는 정상 (아직 설정 안 함)
        if (err.response?.status !== 404) {
          console.error('❌ [설정] 스타일 프로필 조회 중 오류:', err);
        }
      }
      setStyleProfile(styleData);

      console.log('✅ [설정] 모든 데이터 로드 완료');
    } catch (err) {
      console.error('❌ [설정] 데이터 로드 실패:', err);
      setError('설정 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 이름 수정 시작
  const handleStartEditName = () => {
    setNewName(profile?.name || '');
    setIsEditingName(true);
  };

  // 이름 수정 취소
  const handleCancelEditName = () => {
    setIsEditingName(false);
    setNewName('');
  };

  // 이름 수정 저장
  const handleSaveName = async () => {
    if (!newName.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    try {
      const updatedProfile = await userAPI.updateProfile(newName.trim());
      setProfile(updatedProfile);
      setIsEditingName(false);
      setNewName('');

      // localStorage의 user 정보도 업데이트
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.name = updatedProfile.name;
      localStorage.setItem('user', JSON.stringify(user));

      alert('이름이 수정되었습니다!');
      console.log('✅ [설정] 이름 수정 완료');
    } catch (err) {
      console.error('❌ [설정] 이름 수정 실패:', err);
      alert('이름 수정에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 비밀번호 변경 모달 열기
  const handleOpenPasswordModal = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordError('');
    setShowPasswordModal(true);
  };

  // 비밀번호 변경 모달 닫기
  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordError('');
  };

  // 비밀번호 변경 처리
  const handleChangePassword = async () => {
    // 유효성 검사
    if (!passwordForm.currentPassword) {
      setPasswordError('현재 비밀번호를 입력해주세요.');
      return;
    }

    if (!passwordForm.newPassword) {
      setPasswordError('새 비밀번호를 입력해주세요.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('새 비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      await userAPI.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );

      alert('✅ 비밀번호가 변경되었습니다!');
      handleClosePasswordModal();
      console.log('✅ [설정] 비밀번호 변경 완료');
    } catch (err) {
      console.error('❌ [설정] 비밀번호 변경 실패:', err);

      // 에러 메시지 표시
      if (err.response?.status === 401) {
        setPasswordError('현재 비밀번호가 올바르지 않습니다.');
      } else {
        setPasswordError(err.response?.data?.message || '비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Header />
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Header />
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={loadAllData}>다시 시도</button>
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
          <h1 className={styles.title}>설정</h1>
        </div>

        {/* 계정 정보 카드 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>계정 정보</h2>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>닉네임</span>
              <span className={styles.infoValue}>{profile?.username}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>이메일</span>
              <span className={styles.infoValue}>{profile?.email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>이름</span>
              {isEditingName ? (
                <div className={styles.editNameContainer}>
                  <input
                    type="text"
                    className={styles.editNameInput}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    autoFocus
                  />
                  <button className={styles.saveNameButton} onClick={handleSaveName}>
                    저장
                  </button>
                  <button className={styles.cancelNameButton} onClick={handleCancelEditName}>
                    취소
                  </button>
                </div>
              ) : (
                <div className={styles.nameWithEdit}>
                  <span className={styles.infoValue}>{profile?.name}</span>
                  <button className={styles.editButton} onClick={handleStartEditName}>
                    수정
                  </button>
                </div>
              )}
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>가입일</span>
              <span className={styles.infoValue}>{formatDate(profile?.created_at)}</span>
            </div>
          </div>
          <div className={styles.cardFooter}>
            <button
              className={styles.secondaryButton}
              onClick={handleOpenPasswordModal}
            >
              비밀번호 변경
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>내 통계</h2>
            <p className={styles.cardDescription}>
              업로드한 대화 내역과 생성된 데이터 통계입니다
            </p>
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statIcon}>💬</div>
              <div className={styles.statInfo}>
                <div className={styles.statValue}>{stats?.conversations || 0}</div>
                <div className={styles.statLabel}>업로드한 대화</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statIcon}>📨</div>
              <div className={styles.statInfo}>
                <div className={styles.statValue}>{stats?.totalMessages || 0}</div>
                <div className={styles.statLabel}>전체 메시지</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statIcon}>✍️</div>
              <div className={styles.statInfo}>
                <div className={styles.statValue}>{stats?.myMessages || 0}</div>
                <div className={styles.statLabel}>내가 보낸 메시지</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statIcon}>🎨</div>
              <div className={styles.statInfo}>
                <div className={styles.statValue}>{stats?.toneSamples || 0}</div>
                <div className={styles.statLabel}>톤 샘플</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statIcon}>👥</div>
              <div className={styles.statInfo}>
                <div className={styles.statValue}>{stats?.relationships || 0}</div>
                <div className={styles.statLabel}>설정한 관계</div>
              </div>
            </div>
          </div>
        </div>

        {/* 말투 설정 카드 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>말투 커스터마이징</h2>
            <p className={styles.cardDescription}>
              AI가 답변을 생성할 때 따라야 할 당신만의 말투 규칙을 설정하세요
            </p>
          </div>
          <div className={styles.cardBody}>
            {styleProfile ? (
              <div className={styles.styleProfileInfo}>
                <div className={styles.styleProfileStatus}>
                  <span className={styles.statusBadge}>✓ 설정됨</span>
                  <span className={styles.statusDate}>
                    마지막 수정: {formatDate(styleProfile.updated_at)}
                  </span>
                </div>
                <div className={styles.guidelinesPreview}>
                  <p className={styles.guidelinesLabel}>설정한 가이드라인:</p>
                  <div className={styles.guidelinesText}>
                    {styleProfile.custom_guidelines || '(내용 없음)'}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.noStyleProfile}>
                <p>아직 커스텀 말투를 설정하지 않았습니다.</p>
                <p className={styles.noStyleProfileHint}>
                  말투 설정 페이지에서 당신만의 스타일을 만들어보세요!
                </p>
              </div>
            )}
          </div>
          <div className={styles.cardFooter}>
            <button
              className={styles.primaryButton}
              onClick={() => navigate('/settings/style-profile')}
            >
              {styleProfile ? '말투 설정 수정하기' : '말투 설정하기'}
            </button>
          </div>
        </div>

        {/* 기타 설정 카드 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>기타</h2>
          </div>
          <div className={styles.cardBody}>
            <button
              className={styles.dangerButton}
              onClick={() => {
                if (window.confirm('정말 로그아웃하시겠습니까?')) {
                  localStorage.clear();
                  navigate('/login');
                  window.location.reload();
                }
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPasswordModal && (
        <div className={styles.modalOverlay} onClick={handleClosePasswordModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>비밀번호 변경</h2>
              <button className={styles.modalCloseButton} onClick={handleClosePasswordModal}>
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>현재 비밀번호</label>
                <input
                  type="password"
                  className={styles.formInput}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({
                    ...passwordForm,
                    currentPassword: e.target.value
                  })}
                  placeholder="현재 비밀번호를 입력하세요"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>새 비밀번호</label>
                <input
                  type="password"
                  className={styles.formInput}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value
                  })}
                  placeholder="새 비밀번호를 입력하세요 (최소 6자)"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>새 비밀번호 확인</label>
                <input
                  type="password"
                  className={styles.formInput}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value
                  })}
                  placeholder="새 비밀번호를 다시 입력하세요"
                />
              </div>

              {passwordError && (
                <div className={styles.errorMessage}>
                  {passwordError}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.modalCancelButton} onClick={handleClosePasswordModal}>
                취소
              </button>
              <button className={styles.modalSaveButton} onClick={handleChangePassword}>
                변경하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
