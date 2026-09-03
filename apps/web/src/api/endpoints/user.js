import api from '../clients/http.js';

// 사용자 정보 관련 API 서비스 함수들
export const userAPI = {
  // 현재 사용자 정보 조회
  getMyProfile: async () => {
    try {
      console.log('📞 [API 호출] GET /auth/me');
      const response = await api.get('/auth/me');
      console.log('📥 [API 응답] 내 프로필:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [API 실패] 프로필 조회:', error.response?.data || error.message);
      throw error;
    }
  },

  // 프로필 수정 (이름 변경)
  updateProfile: async (name) => {
    try {
      console.log('📞 [API 호출] PATCH /auth/profile', { name });
      const response = await api.patch('/auth/profile', { name });
      console.log('📥 [API 응답] 프로필 수정 성공:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [API 실패] 프로필 수정:', error.response?.data || error.message);
      throw error;
    }
  },

  // 대화 통계 조회
  getStats: async () => {
    try {
      console.log('📞 [API 호출] GET /auth/stats');
      const response = await api.get('/auth/stats');
      console.log('📥 [API 응답] 통계:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [API 실패] 통계 조회:', error.response?.data || error.message);
      throw error;
    }
  },

  // 비밀번호 변경
  changePassword: async (currentPassword, newPassword) => {
    try {
      console.log('📞 [API 호출] PATCH /auth/password');
      const response = await api.patch('/auth/password', {
        currentPassword,
        newPassword
      });
      console.log('📥 [API 응답] 비밀번호 변경 성공:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [API 실패] 비밀번호 변경:', error.response?.data || error.message);
      throw error;
    }
  }
};

// 개별 함수들을 편의를 위해 개별적으로 export
export const {
  getMyProfile,
  updateProfile,
  getStats,
  changePassword
} = userAPI;
