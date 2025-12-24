# Issue #2: SearchDialog 불필요한 연산 최적화

## Labels
`기본과제`, `performance`, `priority: high`

## 목표
- 매 렌더링마다 실행되는 필터링 연산 최소화
- `useMemo`를 활용한 연산 결과 캐싱

## 작업 내용
- [ ] `getFilteredLectures` 함수를 `useMemo`로 메모이제이션
- [ ] `allMajors` 계산을 `useMemo`로 메모이제이션
- [ ] `visibleLectures` 계산을 `useMemo`로 메모이제이션
- [ ] `lastPage` 계산을 `useMemo`로 메모이제이션
- [ ] 의존성 배열 최적화 (lectures, searchOptions)

## 관련 파일
- `src/SearchDialog.tsx` (라인 105-142)

## 현재 문제 코드
```typescript
const getFilteredLectures = () => {
  const { query = '', credits, grades, days, times, majors } = searchOptions;
  return lectures
    .filter(lecture =>
      lecture.title.toLowerCase().includes(query.toLowerCase()) ||
      lecture.id.toLowerCase().includes(query.toLowerCase())
    )
    .filter(lecture => grades.length === 0 || grades.includes(lecture.grade))
    .filter(lecture => majors.length === 0 || majors.includes(lecture.major))
    .filter(lecture => !credits || lecture.credits.startsWith(String(credits)))
    .filter(lecture => {
      if (days.length === 0) return true;
      const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
      return schedules.some(s => days.includes(s.day));
    })
    .filter(lecture => {
      if (times.length === 0) return true;
      const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
      return schedules.some(s => s.range.some(time => times.includes(time)));
    });
};

// 문제: 매 렌더링마다 필터링 연산 실행 (page 변경 시에도!)
const filteredLectures = getFilteredLectures();
const lastPage = Math.ceil(filteredLectures.length / PAGE_SIZE);
const visibleLectures = filteredLectures.slice(0, page * PAGE_SIZE);
const allMajors = [...new Set(lectures.map(lecture => lecture.major))];
```

### 문제점 분석
1. **매 렌더링마다 필터링**: `page`만 변경되어도 전체 필터링 로직이 재실행됨
2. **불필요한 Set 생성**: `allMajors`가 매번 새로 계산됨
3. **체인 필터링 비효율**: 6개의 filter 체인이 매번 실행됨

## 구현 힌트

### 1. filteredLectures 메모이제이션
```typescript
const filteredLectures = useMemo(() => {
  const { query = '', credits, grades, days, times, majors } = searchOptions;

  return lectures
    .filter(lecture =>
      lecture.title.toLowerCase().includes(query.toLowerCase()) ||
      lecture.id.toLowerCase().includes(query.toLowerCase())
    )
    .filter(lecture => grades.length === 0 || grades.includes(lecture.grade))
    .filter(lecture => majors.length === 0 || majors.includes(lecture.major))
    .filter(lecture => !credits || lecture.credits.startsWith(String(credits)))
    .filter(lecture => {
      if (days.length === 0) return true;
      const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
      return schedules.some(s => days.includes(s.day));
    })
    .filter(lecture => {
      if (times.length === 0) return true;
      const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
      return schedules.some(s => s.range.some(time => times.includes(time)));
    });
}, [lectures, searchOptions]);
```

### 2. 파생 값들도 메모이제이션
```typescript
// lastPage는 filteredLectures.length가 변경될 때만 재계산
const lastPage = useMemo(
  () => Math.ceil(filteredLectures.length / PAGE_SIZE),
  [filteredLectures.length]
);

// visibleLectures는 filteredLectures나 page가 변경될 때만 재계산
const visibleLectures = useMemo(
  () => filteredLectures.slice(0, page * PAGE_SIZE),
  [filteredLectures, page]
);

// allMajors는 lectures가 변경될 때만 재계산
const allMajors = useMemo(
  () => [...new Set(lectures.map(lecture => lecture.major))],
  [lectures]
);
```

### 3. 최종 리팩토링 예시
```typescript
const SearchDialog = ({ searchInfo, onClose }: Props) => {
  const { setSchedulesMap } = useScheduleContext();

  const loaderWrapperRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [page, setPage] = useState(1);
  const [searchOptions, setSearchOptions] = useState<SearchOption>({
    query: '',
    grades: [],
    days: [],
    times: [],
    majors: [],
  });

  // 필터링 결과 메모이제이션
  const filteredLectures = useMemo(() => {
    const { query = '', credits, grades, days, times, majors } = searchOptions;

    return lectures
      .filter(lecture =>
        lecture.title.toLowerCase().includes(query.toLowerCase()) ||
        lecture.id.toLowerCase().includes(query.toLowerCase())
      )
      .filter(lecture => grades.length === 0 || grades.includes(lecture.grade))
      .filter(lecture => majors.length === 0 || majors.includes(lecture.major))
      .filter(lecture => !credits || lecture.credits.startsWith(String(credits)))
      .filter(lecture => {
        if (days.length === 0) return true;
        const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
        return schedules.some(s => days.includes(s.day));
      })
      .filter(lecture => {
        if (times.length === 0) return true;
        const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
        return schedules.some(s => s.range.some(time => times.includes(time)));
      });
  }, [lectures, searchOptions]);

  // 파생 값들 메모이제이션
  const lastPage = useMemo(
    () => Math.ceil(filteredLectures.length / PAGE_SIZE),
    [filteredLectures.length]
  );

  const visibleLectures = useMemo(
    () => filteredLectures.slice(0, page * PAGE_SIZE),
    [filteredLectures, page]
  );

  const allMajors = useMemo(
    () => [...new Set(lectures.map(lecture => lecture.major))],
    [lectures]
  );

  // ... 나머지 로직
};
```

## 기대 효과
- 인피니트 스크롤 시 불필요한 필터링 연산 제거
- page 변경 시 필터링 재실행 방지 (slice만 재실행)
- 전체적인 렌더링 성능 향상

## 검증 방법
1. React DevTools Profiler에서 렌더링 시간 측정
2. 인피니트 스크롤 시 "getFilteredLectures" 관련 연산 시간 확인
3. 이전 vs 이후 렌더링 시간 비교

## 주의사항
- `useMemo`의 의존성 배열을 정확하게 설정해야 함
- `searchOptions` 객체가 변경될 때만 필터링이 재실행되도록 보장

## 참고 자료
- [useMemo - React 공식 문서](https://react.dev/reference/react/useMemo)
- [When to useMemo and useCallback](https://kentcdodds.com/blog/usememo-and-usecallback)
