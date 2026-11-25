# 퇴사 다이어리

퇴사하고 싶은 날에 색 점과 짧은 메모를 남기는 다이어리입니다. 웹과 iOS 앱을 함께 제공하는 것을 목표로 합니다.

## 개발 환경

- Node.js 20.19+ 또는 22.12+
- Supabase 프로젝트 (Google OAuth와 PostgreSQL)
- iOS 빌드에는 macOS, Xcode, Apple Developer 계정 필요

```sh
npm install
cp .env.example .env
npm run dev
```

로그인하지 않은 기록은 브라우저 `localStorage`에 보관됩니다. Google 또는 Apple 로그인 시 기존 게스트 기록 중 서버에 없는 날짜를 계정으로 가져옵니다. 로그인 뒤의 변경은 로컬 캐시와 Supabase에 함께 저장됩니다.

## Supabase 준비

1. Supabase 프로젝트를 만들고 Project URL과 publishable key를 `.env`에 입력합니다.
2. SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행합니다. 이 테이블은 사용자별 행 수준 접근 제어(RLS)를 켜서 본인 기록만 읽고 수정하도록 설정합니다.
3. Supabase Authentication의 Google 및 Apple provider를 설정하고 각 제공자의 OAuth 클라이언트 정보를 등록합니다.
4. Supabase의 Site URL과 Redirect URLs에 웹 배포 도메인, 개발 주소, `exitdiary://auth/callback`을 등록합니다.
5. 계정 삭제 Edge Function을 배포합니다. Function은 로그인 세션을 확인한 뒤에만 해당 계정을 지웁니다.

```sh
supabase functions deploy delete-account
```

웹 로그인은 Supabase Auth OAuth 흐름을 사용합니다. iOS에서는 Capacitor가 외부 브라우저를 열고 `exitdiary://auth/callback` 딥링크로 돌아오도록 구성합니다. Xcode에서 같은 URL scheme을 앱 URL Types에 등록해야 합니다. `.env`에는 공개 클라이언트 키만 두고 `service_role` 키를 넣지 마세요. Service role 키는 Supabase Edge Function에서만 사용합니다.

## iOS 앱

웹 자산을 빌드한 뒤 Capacitor iOS 플랫폼을 생성하고 Xcode에서 앱 식별자, 서명, 아이콘, 개인정보 설정을 완성합니다.

```sh
npm run build
npm run cap:add:ios
npm run cap:sync
npm run cap:open:ios
```

App Store 제출 전 계정 삭제 및 개인정보 처리방침 링크, 앱 내 데이터 처리 안내, 앱 아이콘/스크린샷/메타데이터를 준비해야 합니다. 이 앱은 Google과 Apple 로그인, 게스트 사용을 제공합니다.
