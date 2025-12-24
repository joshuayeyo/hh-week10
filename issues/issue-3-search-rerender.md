# Issue #3: SearchDialog 불필요한 리렌더링 최적화

## Labels
`기본과제`, `performance`, `priority: high`

## 목표
- 전공 목록, 강의 목록 컴포넌트의 불필요한 리렌더링 방지
- `React.memo`와 `useCallback`을 활용한 컴포넌트 최적화

## 작업 내용
- [ ] 전공 목록 체크박스 컴포넌트 분리 및 `React.memo` 적용
- [ ] 강의 목록 테이블 행 컴포넌트 분리 및 `React.memo` 적용
- [ ] `changeSearchOption` 함수 `useCallback` 적용
- [ ] `addSchedule` 함수 `useCallback` 적용
- [ ] 기타 이벤트 핸들러 `useCallback` 적용

## 관련 파일
- `src/SearchDialog.tsx`

## 현재 문제점

### 1. 전공 목록 리렌더링
- 하나의 체크박스를 클릭해도 모든 체크박스가 리렌더링됨
- 약 30ms의 불필요한 렌더링 시간 발생

### 2. 강의 목록 리렌더링
- 인피니트 스크롤로 새 데이터를 불러올 때 기존 항목도 모두 리렌더링됨
- 스크롤을 내릴수록 렌더링 비용이 기하급수적으로 증가
- 3000개 결과 중 마지막 페이지(30페이지)까지 가면 tbody에서만 600ms 소요

## 구현 힌트

### 1. 전공 체크박스 컴포넌트 분리 및 메모이제이션

```typescript
// 별도 컴포넌트로 분리
interface MajorCheckboxProps {
  major: string;
  isChecked: boolean;
  onChange: (major: string, isChecked: boolean) => void;
}

const MajorCheckbox = memo(({ major, isChecked, onChange }: MajorCheckboxProps) => (
  <Checkbox
    isChecked={isChecked}
    onChange={(e) => onChange(major, e.target.checked)}
  >
    {major}
  </Checkbox>
));

MajorCheckbox.displayName = 'MajorCheckbox';
```

### 2. 전공 체크박스 핸들러 메모이제이션

```typescript
// SearchDialog 내부
const handleMajorChange = useCallback((major: string, isChecked: boolean) => {
  setSearchOptions(prev => ({
    ...prev,
    majors: isChecked
      ? [...prev.majors, major]
      : prev.majors.filter(m => m !== major)
  }));
  setPage(1);
  loaderWrapperRef.current?.scrollTo(0, 0);
}, []);

// 사용
{allMajors.map(major => (
  <MajorCheckbox
    key={major}
    major={major}
    isChecked={searchOptions.majors.includes(major)}
    onChange={handleMajorChange}
  />
))}
```

### 3. 강의 테이블 행 컴포넌트 분리

```typescript
interface LectureRowProps {
  lecture: Lecture;
  onAdd: (lecture: Lecture) => void;
}

const LectureRow = memo(({ lecture, onAdd }: LectureRowProps) => (
  <Tr>
    <Td width="100px">{lecture.id}</Td>
    <Td width="50px">{lecture.grade}</Td>
    <Td width="200px">{lecture.title}</Td>
    <Td width="50px">{lecture.credits}</Td>
    <Td width="150px" dangerouslySetInnerHTML={{ __html: lecture.major }} />
    <Td width="150px" dangerouslySetInnerHTML={{ __html: lecture.schedule }} />
    <Td width="80px">
      <Button size="sm" colorScheme="green" onClick={() => onAdd(lecture)}>
        추가
      </Button>
    </Td>
  </Tr>
));

LectureRow.displayName = 'LectureRow';
```

### 4. addSchedule 함수 메모이제이션

```typescript
const addSchedule = useCallback((lecture: Lecture) => {
  if (!searchInfo) return;

  const { tableId } = searchInfo;
  const schedules = parseSchedule(lecture.schedule).map(schedule => ({
    ...schedule,
    lecture
  }));

  setSchedulesMap(prev => ({
    ...prev,
    [tableId]: [...prev[tableId], ...schedules]
  }));

  onClose();
}, [searchInfo, setSchedulesMap, onClose]);
```

### 5. changeSearchOption 메모이제이션

```typescript
const changeSearchOption = useCallback(
  (field: keyof SearchOption, value: SearchOption[typeof field]) => {
    setPage(1);
    setSearchOptions(prev => ({ ...prev, [field]: value }));
    loaderWrapperRef.current?.scrollTo(0, 0);
  },
  []
);
```

### 6. 최종 사용 예시

```typescript
// 테이블 body 부분
<Tbody>
  {visibleLectures.map((lecture, index) => (
    <LectureRow
      key={`${lecture.id}-${index}`}
      lecture={lecture}
      onAdd={addSchedule}
    />
  ))}
</Tbody>
```

## 기대 효과
- 전공 목록 렌더링 약 30ms → 최소화
- 페이지네이션 시 기존 항목 리렌더링 방지 (새 항목만 렌더링)
- 전체적인 UI 반응성 향상

## 검증 방법
1. React DevTools Profiler에서 "Highlight updates when components render" 활성화
2. 체크박스 클릭 시 해당 체크박스만 깜빡이는지 확인
3. 인피니트 스크롤 시 새로 추가되는 행만 깜빡이는지 확인
4. Profiler에서 렌더링 시간 측정

## 주의사항
- `React.memo`는 props가 동일할 때만 리렌더링을 방지함
- `useCallback`의 의존성 배열을 정확하게 설정해야 함
- 컴포넌트에 `displayName` 설정으로 디버깅 용이하게

## 참고 자료
- [React.memo - React 공식 문서](https://react.dev/reference/react/memo)
- [useCallback - React 공식 문서](https://react.dev/reference/react/useCallback)
- [Before You memo()](https://overreacted.io/before-you-memo/)
