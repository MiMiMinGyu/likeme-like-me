import api from '../clients/http.js';

// LLM 스타일 프로필 API 서비스 함수들
export const llmAPI = {
  // 내 말투 설정 조회
  getStyleProfile: async () => {
    try {
      console.log('📞 [API 호출] GET /llm/style-profile');
      const response = await api.get('/llm/style-profile');
      console.log('📥 [API 응답] 스타일 프로필:', response.data);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('ℹ️ [API] 저장된 스타일 프로필 없음 (404)');
        return null;
      }
      console.error('❌ [API 실패] 스타일 프로필 조회:', error.response?.data || error.message);
      throw error;
    }
  },

  // 내 말투 설정 저장/수정
  saveStyleProfile: async (customGuidelines) => {
    try {
      console.log('📞 [API 호출] POST /llm/style-profile', { customGuidelines });
      const response = await api.post('/llm/style-profile', {
        customGuidelines
      });
      console.log('📥 [API 응답] 스타일 프로필 저장 성공:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [API 실패] 스타일 프로필 저장:', error.response?.data || error.message);
      throw error;
    }
  },

  // 내 말투 설정 삭제 (초기화)
  deleteStyleProfile: async () => {
    try {
      console.log('📞 [API 호출] DELETE /llm/style-profile');
      const response = await api.delete('/llm/style-profile');
      console.log('📥 [API 응답] 스타일 프로필 삭제 성공');
      return response.data;
    } catch (error) {
      console.error('❌ [API 실패] 스타일 프로필 삭제:', error.response?.data || error.message);
      throw error;
    }
  }
};

// 개별 함수들을 편의를 위해 개별적으로 export
export const {
  getStyleProfile,
  saveStyleProfile,
  deleteStyleProfile
} = llmAPI;
