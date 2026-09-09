// API 서버 베이스 URL — 앱 전체의 단일 출처.
//
//   dev   : .env.development 의 VITE_API_BASE_URL=http://localhost:3000
//           (Vite dev 서버가 별도 포트라 절대 URL 필요)
//   prod  : .env.production 은 빈 값 → 상대 경로가 되어 같은 오리진으로 요청.
//           Caddy(apps/web/Caddyfile)가 /auth /llm /telegram 등을 api 컨테이너로
//           리버스 프록시하므로 CORS·혼합콘텐츠 문제가 없다.
//
// Vite 는 빌드 시 import.meta.env.VITE_* 를 정적으로 치환한다.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
