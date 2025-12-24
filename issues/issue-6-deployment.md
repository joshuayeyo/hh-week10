# Issue #6: gh-pages 배포 설정

## Labels
`deployment`, `setup`

## 목표
- GitHub Pages를 통한 프로젝트 배포
- 배포 자동화 스크립트 설정

## 작업 내용
- [ ] `gh-pages` 패키지 설치
- [ ] `vite.config.ts`에 base 경로 설정
- [ ] `package.json`에 배포 스크립트 추가 (`predeploy`, `deploy`)
- [ ] 배포 실행 및 URL 확인

## 관련 파일
- `package.json`
- `vite.config.ts`

## 구현 가이드

### 1. gh-pages 패키지 설치

```bash
pnpm add -D gh-pages
```

### 2. vite.config.ts 수정

```typescript
import { defineConfig as defineTestConfig, mergeConfig } from 'vitest/config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default mergeConfig(
  defineConfig({
    plugins: [react()],
    base: '/front_7th_chapter4-2/', // GitHub 레포지토리 이름으로 설정
  }),
  defineTestConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
      coverage: {
        reportsDirectory: "./.coverage",
        reporter: ['lcov', 'json', 'json-summary']
      },
    },
  })
)
```

### 3. package.json scripts 추가

```json
{
  "scripts": {
    "dev": "vite",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "build": "tsc -b && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "predeploy": "pnpm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

### 4. 배포 실행

```bash
# 배포 실행 (predeploy가 자동으로 먼저 실행됨)
pnpm run deploy
```

### 5. GitHub Pages 설정 확인

1. GitHub 레포지토리로 이동
2. Settings > Pages 클릭
3. Source: "Deploy from a branch" 선택
4. Branch: "gh-pages" / "(root)" 선택
5. Save 클릭

## 배포 후 확인사항

### URL 형식
```
https://{username}.github.io/front_7th_chapter4-2/
```

### 확인 체크리스트
- [ ] 메인 페이지가 정상적으로 로드되는지 확인
- [ ] API 데이터(schedules-majors.json, schedules-liberal-arts.json)가 정상 로드되는지 확인
- [ ] 시간표 기능이 정상 동작하는지 확인
- [ ] 검색 모달이 정상 동작하는지 확인
- [ ] 드래그 앤 드롭이 정상 동작하는지 확인

## 트러블슈팅

### 1. 404 에러가 발생하는 경우
- `vite.config.ts`의 `base` 경로가 레포지토리 이름과 일치하는지 확인
- 레포지토리 이름: `front_7th_chapter4-2`
- base 설정: `/front_7th_chapter4-2/`

### 2. 빌드 에러가 발생하는 경우
```bash
# TypeScript 에러 확인
pnpm run build

# 로컬에서 빌드 결과 확인
pnpm run build && npx serve dist
```

### 3. gh-pages 브랜치가 생성되지 않는 경우
```bash
# 수동으로 gh-pages 브랜치 푸시
git checkout -b gh-pages
git push origin gh-pages
git checkout main
```

### 4. 배포 후 변경사항이 반영되지 않는 경우
- GitHub Actions 또는 GitHub Pages 캐시 문제일 수 있음
- 몇 분 기다린 후 새로고침
- 브라우저 캐시 삭제 후 확인

## 기대 결과
- `https://{username}.github.io/front_7th_chapter4-2/` 형태로 배포 완료
- 모든 기능이 정상 동작

## 참고 자료
- [Vite - Deploying a Static Site](https://vitejs.dev/guide/static-deploy.html#github-pages)
- [gh-pages npm 패키지](https://www.npmjs.com/package/gh-pages)
- [GitHub Pages 공식 문서](https://docs.github.com/en/pages)
