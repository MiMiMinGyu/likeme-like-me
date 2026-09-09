import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { telegramAPI } from '../../api/endpoints/chat';
import { relationshipAPI, RELATIONSHIP_LABELS, POLITENESS_LABELS, VIBE_LABELS } from '../../api/endpoints/relationship';
import api, { refreshAccessToken } from '../../api/clients/http';
import { API_BASE_URL } from '../../config';
import Header from '../../components/layout/Header';
import styles from './ChatPage.module.css';

const ChatPage = () => {
  const { userId: partnerId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState('');
  const [showConversationList, setShowConversationList] = useState(false);
  const [relationship, setRelationship] = useState(null);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [relationshipForm, setRelationshipForm] = useState({
    category: '',
    politeness: '',
    vibe: '',
    emojiLevel: 0
  });

  // relationship의 최신 값을 참조하기 위한 ref
  const relationshipRef = useRef(relationship);
  useEffect(() => {
    relationshipRef.current = relationship;
  }, [relationship]);

  // 메시지/AI 추천 답변이 바뀌어 채팅창 높이가 변할 때마다 바닥으로 스크롤
  const messagesContainerRef = useRef(null);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, recommendations, recommendationLoading]);

  // 대화 목록 가져오기
  const fetchConversations = useCallback(async () => {
    try {
      const data = await telegramAPI.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('대화 목록 조회 실패:', err);
    }
  }, []);

  // 관계 정보 가져오기
  const fetchRelationship = useCallback(async () => {
    if (!partnerId) return;

    try {
      console.log('🔗 [관계 조회] partnerId:', partnerId);
      const relationships = await relationshipAPI.getRelationships();
      console.log('🔗 [관계 조회] 전체 관계 목록:', relationships);

      const currentRelationship = relationships.find(
        (rel) => rel.partner_id === partnerId
      );

      if (currentRelationship) {
        console.log('✅ [관계 조회] 현재 partner의 관계 설정 찾음:', currentRelationship);
        setRelationship(currentRelationship);
        setRelationshipForm({
          category: currentRelationship.category,
          politeness: currentRelationship.politeness,
          vibe: currentRelationship.vibe,
          emojiLevel: currentRelationship.emoji_level
        });
      } else {
        console.log('⚠️ [관계 조회] 현재 partner의 관계 설정 없음');
        setRelationship(null);
      }
    } catch (err) {
      console.error('❌ [관계 조회] 실패:', err);
    }
  }, [partnerId]);

  // 관계 저장/수정
  const handleSaveRelationship = async () => {
    // 필수 필드 검증
    if (!relationshipForm.category) {
      alert('관계 카테고리를 선택해주세요');
      return;
    }

    try {
      // 빈 값을 제거하고 API에 전달 (선택 필드만)
      const requestData = {
        partnerId: partnerId,
        category: relationshipForm.category,
        ...(relationshipForm.politeness && { politeness: relationshipForm.politeness }),
        ...(relationshipForm.vibe && { vibe: relationshipForm.vibe }),
        emojiLevel: relationshipForm.emojiLevel
      };

      if (relationship) {
        // 수정
        await relationshipAPI.updateRelationship(relationship.id, requestData);
      } else {
        // 생성
        await relationshipAPI.createRelationship(requestData);
      }
      await fetchRelationship();
      setShowRelationshipModal(false);
    } catch (err) {
      console.error('관계 저장 실패:', err);
      alert('관계 설정 저장에 실패했습니다');
    }
  };

  const handleGenerateRecommendations = useCallback(async (messageId) => {
    try {
      console.log('🤖 [AI 추천] messageId:', messageId);
      console.log('🤖 [AI 추천] 현재 관계 설정:', relationshipRef.current);
      console.log('🤖 [AI 추천] partnerId:', partnerId);

      setRecommendationLoading(true);
      const result = await telegramAPI.generateRecommendations(messageId);

      console.log('🤖 [AI 추천] 생성된 추천 답변:', result.recommendations);
      setRecommendations(result.recommendations || []);
    } catch (err) {
      console.error('❌ [AI 추천] 실패:', err);
      setRecommendations([]);
    } finally {
      setRecommendationLoading(false);
    }
  }, [partnerId]);

  const fetchConversationMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // axios로 API 호출 (자동 토큰 갱신 지원)
      const response = await api.get(`/telegram/conversations/${partnerId}/messages`);
      const data = response.data;

      setPartner(data.partner);

      // 메시지를 시간순으로 정렬 (오래된 메시지가 위, 최신 메시지가 아래)
      const sortedMessages = (data.messages || []).sort((a, b) => {
        return new Date(a.created_at) - new Date(b.created_at);
      });

      console.log('📝 [메시지 정렬] 총', sortedMessages.length, '개 메시지');
      setMessages(sortedMessages);

      if (data.messages && data.messages.length > 0) {
        const lastMessage = data.messages[data.messages.length - 1];
        console.log('마지막 메시지:', lastMessage); // 디버깅용

        // 상대방(user)의 메시지이고, messageId가 있을 때만 추천 생성
        if (lastMessage.role === 'user' && lastMessage.id) {
          handleGenerateRecommendations(lastMessage.id);
        } else if (lastMessage.role === 'user' && !lastMessage.id) {
          console.warn('메시지 ID가 없습니다:', lastMessage);
        }
      }
    } catch (err) {
      console.error('대화 메시지 조회 실패:', err);
      setError(err.response?.data?.message || err.message || '대화를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [partnerId, handleGenerateRecommendations]);

  useEffect(() => {
    fetchConversations();

    if (partnerId) {
      fetchConversationMessages();
      fetchRelationship();
    }

    let eventSource = null;
    let reconnectTimeout = null;

    const connectSSE = () => {
      // SSE 연결 시 토큰을 쿼리 파라미터로 전달
      const token = localStorage.getItem('access_token');
      const sseUrl = `${API_BASE_URL}/telegram/events?token=${token}`;
      console.log('📡 [SSE] 연결 시도:', sseUrl);

      eventSource = new EventSource(sseUrl);

      // SSE 연결 성공
      eventSource.onopen = () => {
        console.log('✅ [SSE] 연결 성공');
      };

      // 'newMessage' 타입 이벤트 (백엔드가 event: newMessage로 전송)
      eventSource.addEventListener('newMessage', (event) => {
        console.log('📨 [SSE] newMessage 이벤트 수신');
        console.log('📨 [SSE] Event data:', event.data);

        try {
          const newMessage = JSON.parse(event.data);
          console.log('📨 [SSE] Parsed message:', newMessage);
          console.log('🔄 [SSE] 대화 목록 및 메시지 갱신 시작...');
          fetchConversationMessages();
          fetchConversations();
        } catch (err) {
          console.error('❌ [SSE] JSON 파싱 실패:', err);
        }
      });

      eventSource.onerror = async (error) => {
        console.error('❌ [SSE] 연결 오류:', error);
        console.error('❌ [SSE] eventSource.readyState:', eventSource.readyState);
        eventSource.close();

        // 토큰 갱신 후 3초 후 재연결
        reconnectTimeout = setTimeout(async () => {
          try {
            console.log('🔄 [SSE] 토큰 갱신 중...');
            await refreshAccessToken();
            console.log('🔄 [SSE] SSE 재연결 시도...');
            connectSSE();
          } catch (err) {
            console.error('❌ [SSE] 토큰 갱신 실패:', err);
            // refreshAccessToken이 실패하면 자동으로 로그인 페이지로 리다이렉트됨
          }
        }, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [partnerId, fetchConversationMessages, fetchConversations, fetchRelationship]);

  const handleSendReply = async (messageId, selectedReply) => {
    try {
      console.log('💬 [답변 전송] messageId:', messageId, 'selectedReply:', selectedReply);
      await telegramAPI.sendReply(messageId, selectedReply);
      console.log('✅ [답변 전송] 성공');
      setRecommendations([]);
      fetchConversationMessages();
    } catch (err) {
      console.error('❌ [답변 전송] 실패:', err);
      alert('답변 전송에 실패했습니다');
    }
  };

  const handleSendCustomMessage = async () => {
    if (!inputText.trim()) {
      console.warn('⚠️ [메시지 전송] 입력 텍스트가 비어있음');
      return;
    }

    try {
      console.log('💬 [메시지 전송] partner:', partner);
      console.log('💬 [메시지 전송] telegram_id:', partner?.telegram_id);
      console.log('💬 [메시지 전송] text:', inputText);

      if (!partner || !partner.telegram_id) {
        console.error('❌ [메시지 전송] partner 정보 없음:', partner);
        alert('대화 상대 정보를 불러올 수 없습니다');
        return;
      }

      // 직접 메시지 전송 API 호출
      await telegramAPI.sendMessage(partner.telegram_id, inputText);
      console.log('✅ [메시지 전송] 성공');
      setInputText('');
      fetchConversationMessages();
    } catch (err) {
      console.error('❌ [메시지 전송] 실패:', err);
      alert('메시지 전송에 실패했습니다');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && messages.length === 0) {
    return (
      <div className={styles.container}>
        <Header />
        <div className={styles.loading}>로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Header />
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>돌아가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Header />

      <div className={styles.chatLayout}>
        {/* 햄버거 메뉴 버튼 (작은 화면에서만 표시) */}
        <button
          className={styles.hamburgerButton}
          onClick={() => setShowConversationList(!showConversationList)}
        >
          ☰
        </button>

        {/* 왼쪽: 대화 목록 (30%) */}
        <div className={`${styles.conversationList} ${showConversationList ? styles.conversationListMobileShow : ''}`}>
          <div className={styles.conversationHeader}>
            <h3 className={styles.conversationTitle}>대화 목록</h3>
            <button
              className={styles.closeListButton}
              onClick={() => setShowConversationList(false)}
            >
              ✕
            </button>
          </div>
          <div className={styles.conversationItems}>
            {conversations.map((conv) => (
              <div
                key={conv.partner_id}
                className={`${styles.conversationItem} ${
                  conv.partner_id === partnerId ? styles.conversationItemActive : ''
                }`}
                onClick={() => {
                  navigate(`/chat/${conv.partner_id}`);
                  setShowConversationList(false);
                }}
              >
                <div className={styles.avatar}>
                  <span className={styles.avatarText}>
                    {conv.partner_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className={styles.conversationContent}>
                  <span className={styles.name}>{conv.partner_name}</span>
                  <span className={styles.lastMessage}>{conv.last_message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽: 채팅 윈도우 (70%) */}
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <button className={styles.backButton} onClick={() => navigate('/')}>
              ←
            </button>
            <div className={styles.chatHeaderInfo}>
              <h2 className={styles.chatTitle}>{partner?.name || '대화 상대'}</h2>
              <p className={styles.chatSubtitle}>
                {relationship ? RELATIONSHIP_LABELS[relationship.category] : '관계 미설정'} · {messages.length}개의 메시지
              </p>
            </div>
            <button
              className={styles.relationshipButton}
              onClick={() => setShowRelationshipModal(true)}
              title="관계 설정"
            >
              ⚙️
            </button>
          </div>

          <div className={styles.messagesContainer} ref={messagesContainerRef}>
            {messages.length === 0 ? (
              <div className={styles.emptyMessages}>
                <p>메시지가 없습니다</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`${styles.messageItem} ${
                    message.role === 'assistant' ? styles.messageOutgoing : styles.messageIncoming
                  }`}
                >
                  <div className={styles.messageBubble}>
                    <p className={styles.messageText}>{message.text}</p>
                    <span className={styles.messageTime}>
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* AI 추천 답변 (채팅창 하단에 인라인) */}
          {recommendationLoading && (
            <div className={styles.recommendationInline}>
              <p className={styles.recommendationLabel}>💡 AI 추천 답변 생성 중...</p>
              <div className={styles.loadingSpinner}>
                <div className={styles.spinner}></div>
              </div>
            </div>
          )}
          {!recommendationLoading && recommendations.length > 0 && (
            <div className={styles.recommendationInline}>
              <p className={styles.recommendationLabel}>💡 AI 추천 답변</p>
              <div className={styles.recommendationButtons}>
                {recommendations.map((rec, index) => (
                  <button
                    key={index}
                    className={styles.recommendationButton}
                    onClick={() => handleSendReply(rec.messageId, rec.text)}
                  >
                    {rec.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 메시지 입력창 */}
          <div className={styles.inputContainer}>
            <input
              type="text"
              className={styles.messageInput}
              placeholder="메시지를 입력하세요..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendCustomMessage()}
            />
            <button
              className={styles.sendButton}
              onClick={handleSendCustomMessage}
              disabled={!inputText.trim()}
            >
              전송
            </button>
          </div>
        </div>
      </div>

      {/* 관계 설정 모달 */}
      {showRelationshipModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRelationshipModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>관계 설정</h3>
              <button
                className={styles.modalCloseButton}
                onClick={() => setShowRelationshipModal(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>관계 카테고리</label>
                <select
                  className={styles.formSelect}
                  value={relationshipForm.category}
                  onChange={(e) => setRelationshipForm({ ...relationshipForm, category: e.target.value })}
                >
                  <option value="">-</option>
                  {Object.entries(RELATIONSHIP_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>존댓말 수준</label>
                <select
                  className={styles.formSelect}
                  value={relationshipForm.politeness}
                  onChange={(e) => setRelationshipForm({ ...relationshipForm, politeness: e.target.value })}
                >
                  <option value="">-</option>
                  {Object.entries(POLITENESS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>대화 분위기</label>
                <select
                  className={styles.formSelect}
                  value={relationshipForm.vibe}
                  onChange={(e) => setRelationshipForm({ ...relationshipForm, vibe: e.target.value })}
                >
                  <option value="">-</option>
                  {Object.entries(VIBE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>이모지 사용 빈도: {relationshipForm.emojiLevel}</label>
                <input
                  type="range"
                  className={styles.formRange}
                  min="0"
                  max="5"
                  value={relationshipForm.emojiLevel}
                  onChange={(e) => setRelationshipForm({ ...relationshipForm, emojiLevel: parseInt(e.target.value) })}
                />
                <div className={styles.rangeLabels}>
                  <span>없음</span>
                  <span>매우 많음</span>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.modalCancelButton}
                onClick={() => setShowRelationshipModal(false)}
              >
                취소
              </button>
              <button
                className={styles.modalSaveButton}
                onClick={handleSaveRelationship}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
