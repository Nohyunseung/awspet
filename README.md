## Pet Buddy 앱 모노레포 개요

반려견 견주와 시터 매칭 및 실시간 채팅을 제공하는 앱의 프론트엔드(Expo/React Native)와 백엔드(Node.js/Express)가 포함된 모노레포입니다.

### 구성
- 프론트엔드: Expo + React Native + React Navigation + Zustand + React Query
  - 🐾 강아지 친화적 디자인 시스템 (코랄/브라운 테마)
- 백엔드: Node.js + Express, Socket.IO, MySQL2, Mongoose(MongoDB), AWS S3 업로드
- 데이터 저장소
  - MySQL: 사용자/반려견/예약/공고 등 관계형 데이터
  - MongoDB: 채팅 대화/메시지
  - AWS S3: 이미지 및 파일 업로드(사전서명 URL)

### 디렉터리 구조
```text
.
├─ backend/
│  └─ server/
│     ├─ server.js                     # Express HTTP + Socket.IO, 모든 API 라우트
│     ├─ config/
│     │  └─ database-minimal.js       # MySQL 연결/쿼리 유틸 모듈
│     ├─ db/
│     │  └─ mongo.js                  # MongoDB 연결 유틸
│     ├─ models/                      # 채팅용 Mongoose 모델
│     │  ├─ Conversation.js
│     │  └─ Message.js
│     ├─ scripts/                     # 마이그레이션/스키마 조정 스크립트
│     ├─ README.md                    # 서버 내부 문서(간단)
│     └─ package.json
└─ frontend/
   └─ pet-buddy-ui/
      ├─ src/
      │  ├─ screens/                  # 화면(오너/시터/공용)
      │  ├─ navigation/               # 네비게이션 스택/탭
      │  ├─ services/                # API 클라이언트 등
      │  ├─ store/                    # Zustand 스토어
      │  ├─ styles/                   # 🐾 테마 시스템 (theme.ts, commonStyles.ts)
      │  └─ types/                    # 타입 정의
      ├─ App.tsx
      └─ package.json
```

## 빠른 시작(로컬)

사전 요구사항
- Node.js LTS 이상, npm
- MySQL 8.x(또는 호환), MongoDB 6.x 이상
- AWS S3 버킷(선택: 업로드 기능 사용 시)

### 1) 백엔드 설정 및 실행
```bash
cd backend/server
npm install
# 개발 실행
npm run dev
# 또는
npm start
```

환경 변수(.env 예시)
```bash
# 서버
PORT=3001

# AWS/S3 업로드
AWS_REGION=ap-northeast-2
S3_BUCKET=pet-buddy-uploads

# MongoDB (채팅 저장)
MONGODB_URI=mongodb://127.0.0.1:27017/pet_buddy
# MONGODB_DB 를 별도 지정할 경우만 설정
# MONGODB_DB=pet_buddy
```

MySQL 연결 정보는 기본적으로 `backend/server/config/database-minimal.js` 내 하드코딩 값을 사용합니다. 필요 시 해당 파일에서 `host/user/password/database/port` 값을 실제 환경에 맞게 수정하세요. (파일 상단에 `require('dotenv').config()`가 있으나, 현 버전은 `.env`로 DB 설정을 읽지 않고 코드 상수값을 사용합니다.)

데이터베이스 테이블 준비(필요 시)
- `backend/server/create-minimal-tables.sql`
- 보조 스크립트: `backend/server/setup-*.js`, `backend/server/scripts/*`

### 2) 프론트엔드 설정 및 실행(Expo)
```bash
cd frontend/pet-buddy-ui
npm install

# 웹
npm run web

# 안드로이드 에뮬레이터
npm run android

# iOS 시뮬레이터(Mac)
npm run ios
```

환경 변수(프론트)
```bash
# 서버 루트 URL(끝에 /api 자동 부착됨)
EXPO_PUBLIC_API_URL=http://localhost:3001
```
프론트는 아래 규칙으로 API Base URL을 자동 탐지합니다.
- `EXPO_PUBLIC_API_URL` 우선 사용(자동으로 `/api`를 덧붙임)
- 개발 시 번들/디버거 호스트에서 `http://<host>:3001/api` 추론
- Android 에뮬레이터: `http://10.0.2.2:3001/api`
- 기본 후보: `http://localhost:3001/api`, `http://127.0.0.1:3001/api`

동시에 실행하기(권장)
- 터미널 1: `backend/server` → `npm run dev`
- 터미널 2: `frontend/pet-buddy-ui` → `npm run web` 혹은 `npm run android`

## API 개요

- Base URL: `http://localhost:3001`
- API Prefix: `/api`
- 공통 응답: 성공 `{ success: true, ... }`, 실패 `{ success: false, message?: string, error?: string }`

주요 엔드포인트(요약)
- Auth
  - POST `/api/auth/login` — `{ email, password }`
  - POST `/api/auth/register` — `{ email, password, phone_number? }`
- Dogs
  - GET `/api/dogs/user/:userId`
  - POST `/api/dogs` — `{ user_id, name, profile_image_url?, breed?, personality?, birth_date?, special_notes? }`
  - DELETE `/api/dogs/:dogId` (Query: `user_id`)
- Sitter Postings
  - GET `/api/sitter-postings`
  - POST `/api/sitter-postings` — `{ sitter_id, title, description?, location?, available_from, available_to, status? }`
  - POST `/api/sitter-postings/:postId/close`
- Owner Jobs
  - GET `/api/jobs`
  - POST `/api/jobs` — `{ owner_id, dog_id, title, description?, location?, start_date, end_date, status? }`
  - DELETE `/api/jobs/:jobId`
- Bookings
  - GET `/api/bookings/owner/:ownerId`
  - POST `/api/bookings` — `{ owner_id, sitter_id, dog_id, start_time, end_time, source_post_id? }`
- Conversations(HTTP)
  - POST `/api/conversations` — `{ participantIds: string[] }` (2명 이상)
  - GET `/api/conversations?userId=...`
  - DELETE `/api/conversations/:conversationId`
  - GET `/api/conversations/:conversationId/messages` (Query: `before?, limit<=100`)
- Uploads(S3)
  - POST `/api/uploads/sign` — `{ fileName, contentType }`

자세한 파라미터/응답은 `backend/server/server.js` 참고.

### 모바일 권한/사진 등록 안내

- iOS 권한 문구는 `frontend/pet-buddy-ui/app.json`의 `ios.infoPlist`에 선언되어 있습니다.
  - `NSCameraUsageDescription`: 카메라 접근 사유
  - `NSPhotoLibraryUsageDescription`: 사진 보관함 접근 사유
- Android 권한은 `frontend/pet-buddy-ui/app.json`의 `android.permissions`에 선언되어 있습니다.
  - `android.permission.CAMERA`
- 앱에서 반려견 사진은 두 가지 방식으로 등록할 수 있습니다.
  - 앨범에서 선택: `expo-image-picker.launchImageLibraryAsync`
  - 사진 촬영: `expo-image-picker.launchCameraAsync`
- 촬영/선택된 이미지는 Base64(Data URI)로 서버에 전송하거나, S3 사전서명 URL(`POST /api/uploads/sign`)로 업로드 후 공개 URL을 사용하세요.

## 실시간 채팅(Socket.IO)

클라이언트가 연결되면 다음 이벤트를 주고받습니다.
- 송신
  - `user:join` → `{ ...userData }`
  - `conversation:join` → `conversationId`
  - `conversation:leave` → `conversationId`
  - `message:send` → `{ conversationId, message, senderId, senderName, type='text', imageUri?, fileName?, fileSize? }`
  - `message:read` → `{ conversationId, messageId, userId }`
  - `typing:start`/`typing:stop`
- 수신(서버가 emit)
  - `messages:history` — 대화방 합류 시 전달
  - `message:received` — 새 메시지 브로드캐스트
  - `message:read_updated` — 읽음 상태 갱신
  - `typing:user_started` / `typing:user_stopped`

## 스크립트/유틸

백엔드(`backend/server`)
- 실행: `npm run dev`, `npm start`
- 연결 확인: `test-connection.js`
- 테이블/마이그레이션 관련: `setup-*.js`, `scripts/*`, `create-minimal-tables.sql`

프론트엔드(`frontend/pet-buddy-ui`)
- 실행: `npm run web`, `npm run android`, `npm run ios`, `npm start`

## 보안 및 주의사항

- 현재 인증 토큰은 개발용 문자열(`dev-token`)로 응답되며, 실제 인증 보호 미적용 상태입니다. 프로덕션 전 JWT 등 인증/인가 적용이 필요합니다.
- `database-minimal.js`에 MySQL 비밀정보가 하드코딩되어 있습니다. 운영 환경에서는 환경 변수 또는 시크릿 매니저로 전환하세요.
- CORS는 `*` 허용(개발용)입니다. 운영에서는 도메인 화이트리스트 적용을 권장합니다.

## 트러블슈팅

- 서버 연결 불가
  - `backend/server`에서 3001 포트로 정상 기동 확인
  - 방화벽/포트 충돌 점검, Windows 사용 시 관리자 권한 필요 여부 확인
- 프론트에서 API 탐지 실패
  - `EXPO_PUBLIC_API_URL`을 `http://localhost:3001`로 설정해 강제 지정
  - Android 에뮬레이터는 `10.0.2.2:3001` 경유
- MySQL 에러
  - `database-minimal.js`의 접속 정보/포트(예: 3307) 확인
  - `create-minimal-tables.sql` 및 `setup-*` 스크립트로 스키마 준비
- MongoDB 에러
  - 로컬 MongoDB 실행 여부 확인, `MONGODB_URI` 점검
- S3 업로드 실패
  - `AWS_REGION`, `S3_BUCKET` 환경 변수와 자격증명 확인(자격증명은 AWS 기본 자격 체인 사용)

## 🐾 디자인 시스템

Pet Buddy는 강아지 친화적인 따뜻한 디자인 시스템을 사용합니다.

### 테마 색상
- **Primary**: 코랄 오렌지 (`#FF8C69`) - 따뜻하고 친근한 느낌
- **Secondary**: 브라운 계열 - 자연스럽고 안정감 있는 색상
- **배경**: 부드러운 크림/아이보리 톤

### 사용법
```typescript
import { theme } from '../styles/theme'
import { commonStyles } from '../styles/commonStyles'

// 색상 사용
backgroundColor: theme.colors.primary

// 공통 스타일 적용
style={commonStyles.primaryButton}
```

### 테마 파일
- `src/styles/theme.ts`: 색상, 폰트 크기, 간격, 그림자 등 디자인 토큰
- `src/styles/commonStyles.ts`: 재사용 가능한 컴포넌트 스타일

## 라이선스

프로젝트 내부 정책에 따릅니다. 별도 라이선스 지정 전까지는 사내/개인 개발용으로만 사용하세요.






