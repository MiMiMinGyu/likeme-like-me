import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { telegramAPI } from '../../api/endpoints/chat';
import { refreshAccessToken } from '../../api/clients/http';
import { API_BASE_URL } from '../../config';
import Header from '../../components/layout/Header';
import styles from './MainPage.module.css';

const MainPage = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();

    let eventSource = null;
    let reconnectTimeout = null;

    const connectSSE = () => {
      // SSE로 실시간 메시지 수신 (토큰을 쿼리 파라미터로 전달)
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
          console.log('🔄 [SSE] 대화 목록 갱신 시작...');
          fetchConversations(); // 새 메시지 도착 시 목록 갱신
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
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const data = await telegramAPI.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('대화 목록 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationClick = (partnerId) => {
    navigate(`/chat/${partnerId}`);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const oneDay = 24 * 60 * 60 * 1000;

    if (diff < oneDay && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 2 * oneDay) {
      return '어제';
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className={styles.container}>
      <Header />

      {/* 대화 목록 */}
      <div className={styles.mainContent}>
        <div className={styles.conversationList}>
          <div className={styles.conversationListHeader}>
            <h2 className={styles.conversationListTitle}>메시지</h2>
          </div>

          <div className={styles.conversationItems}>
            {loading && conversations.length === 0 ? (
              <div className={styles.loading}>로딩 중...</div>
            ) : conversations.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyText}>메시지가 없습니다</p>
                <p className={styles.emptySubtext}>
                  텔레그램 봇으로 메시지를 보내보세요!
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.partner_id}
                  className={styles.conversationItem}
                  onClick={() => handleConversationClick(conv.partner_id)}
                >
                  <div className={styles.avatar}>
                    <span className={styles.avatarText}>
                      {conv.partner_name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>

                  <div className={styles.conversationContent}>
                    <div className={styles.conversationHeader}>
                      <span className={styles.name}>{conv.partner_name}</span>
                      <span className={styles.time}>
                        {formatTime(conv.last_message_time)}
                      </span>
                    </div>

                    <div className={styles.conversationFooter}>
                      <span className={styles.lastMessage}>
                        {conv.last_message || '메시지가 없습니다'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
