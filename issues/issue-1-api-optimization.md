# Issue #1: API 호출 최적화 (Promise.all 병렬 처리)

## Labels
`기본과제`, `performance`, `priority: high`

## 목표
- Promise.all이 병렬로 실행되도록 수정
- 중복 API 호출 제거 및 캐싱 구현

## 작업 내용
- [ ] `fetchAllLectures` 함수에서 `await` 키워드를 Promise.all 내부에서 제거하여 병렬 처리 구현
- [ ] 클로저를 이용한 API 캐싱 함수 구현
- [ ] 중복 호출 제거 (현재 6번 → 2번으로 최적화)

## 관련 파일
- `src/SearchDialog.tsx` (라인 85-96)

## 현재 문제 코드
```typescript
const fetchMajors = () => axios.get<Lecture[]>('/schedules-majors.json');
const fetchLiberalArts = () => axios.get<Lecture[]>('/schedules-liberal-arts.json');

// 문제: await가 각 Promise 앞에 있어서 직렬 실행됨
const fetchAllLectures = async () => await Promise.all([
  (console.log('API Call 1', performance.now()), await fetchMajors()),
  (console.log('API Call 2', performance.now()), await fetchLiberalArts()),
  (console.log('API Call 3', performance.now()), await fetchMajors()),
  (console.log('API Call 4', performance.now()), await fetchLiberalArts()),
  (console.log('API Call 5', performance.now()), await fetchMajors()),
  (console.log('API Call 6', performance.now()), await fetchLiberalArts()),
]);
```

### 문제점 분석
1. **직렬 실행**: `await`가 각 Promise 앞에 있어서 이전 요청이 완료되어야 다음 요청이 시작됨
2. **중복 호출**: `fetchMajors`와 `fetchLiberalArts`가 각각 3번씩 호출됨 (총 6번)
3. **캐싱 부재**: 동일한 데이터를 반복적으로 요청

## 구현 힌트

### 1. 병렬 처리 수정
```typescript
// Promise.all 내부에서 await 제거 → 병렬 실행
const fetchAllLectures = async () => {
  const results = await Promise.all([
    fetchMajors(),
    fetchLiberalArts(),
  ]);
  return results;
};
```

### 2. 캐싱 함수 (클로저 활용)
```typescript
// 클로저를 이용한 캐싱 패턴
const createCachedFetch = <T>(fetchFn: () => Promise<T>) => {
  let cache: T | null = null;
  return async () => {
    if (cache) return cache;
    cache = await fetchFn();
    return cache;
  };
};

const cachedFetchMajors = createCachedFetch(() =>
  axios.get<Lecture[]>('/schedules-majors.json').then(res => res.data)
);
const cachedFetchLiberalArts = createCachedFetch(() =>
  axios.get<Lecture[]>('/schedules-liberal-arts.json').then(res => res.data)
);

// 사용
const fetchAllLectures = async () => {
  const [majors, liberalArts] = await Promise.all([
    cachedFetchMajors(),
    cachedFetchLiberalArts(),
  ]);
  return [...majors, ...liberalArts];
};
```

### 3. 최종 리팩토링 예시
```typescript
// API 호출 함수 정의
const fetchMajors = () => axios.get<Lecture[]>('/schedules-majors.json');
const fetchLiberalArts = () => axios.get<Lecture[]>('/schedules-liberal-arts.json');

// 캐싱 래퍼
const createCachedFetch = <T>(fetchFn: () => Promise<AxiosResponse<T>>) => {
  let cache: AxiosResponse<T> | null = null;
  let pending: Promise<AxiosResponse<T>> | null = null;

  return async (): Promise<AxiosResponse<T>> => {
    if (cache) return cache;
    if (pending) return pending;

    pending = fetchFn();
    cache = await pending;
    pending = null;
    return cache;
  };
};

const cachedFetchMajors = createCachedFetch(fetchMajors);
const cachedFetchLiberalArts = createCachedFetch(fetchLiberalArts);

// 병렬 실행 + 중복 제거
const fetchAllLectures = async () => {
  const start = performance.now();
  console.log('API 호출 시작:', start);

  const [majorsRes, liberalArtsRes] = await Promise.all([
    cachedFetchMajors(),
    cachedFetchLiberalArts(),
  ]);

  const end = performance.now();
  console.log('모든 API 호출 완료:', end);
  console.log('API 호출에 걸린 시간(ms):', end - start);

  return [...majorsRes.data, ...liberalArtsRes.data];
};
```

## 기대 효과
- API 호출 시간 약 20ms 개선
- 불필요한 네트워크 요청 제거 (6번 → 2번)
- 병렬 실행으로 전체 로딩 시간 단축

## 검증 방법
1. 개발자 도구 Network 탭에서 API 호출 횟수 확인 (2번만 호출되어야 함)
2. 콘솔에서 API Call 로그 확인 (시작 시점이 거의 동일해야 함)
3. React DevTools Profiler로 성능 측정

## 참고 자료
- [Promise.all() - MDN](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
- [JavaScript 클로저 활용](https://developer.mozilla.org/ko/docs/Web/JavaScript/Closures)
