# Issue #5: 시간표 블록 드롭시 렌더링 최적화

## Labels
`심화과제`, `performance`, `DnD`, `state-management`

## 목표
- schedulesMap 상태 업데이트 시 관련된 시간표만 리렌더링
- 전역 상태 관리 구조 개선

## 작업 내용
- [ ] `ScheduleContext` 상태 관리 개선 (개별 시간표 구독 가능하도록)
- [ ] 시간표별 선택적 구독 패턴 적용 (커스텀 훅)
- [ ] `ScheduleTables` 컴포넌트 메모이제이션
- [ ] `ScheduleTable`에서 필요한 데이터만 구독하도록 수정
- [ ] 상태 업데이트 함수들 메모이제이션

## 관련 파일
- `src/ScheduleContext.tsx`
- `src/ScheduleTables.tsx`
- `src/ScheduleTable.tsx`
- `src/ScheduleDndProvider.tsx` (라인 42-64)

## 현재 문제 코드

### ScheduleContext.tsx
```typescript
interface ScheduleContextType {
  schedulesMap: Record<string, Schedule[]>;
  setSchedulesMap: React.Dispatch<React.SetStateAction<Record<string, Schedule[]>>>;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export const ScheduleProvider = ({ children }: PropsWithChildren) => {
  const [schedulesMap, setSchedulesMap] = useState<Record<string, Schedule[]>>(dummyScheduleMap);

  return (
    <ScheduleContext.Provider value={{ schedulesMap, setSchedulesMap }}>
      {children}
    </ScheduleContext.Provider>
  );
};
```

### 문제점 분석
1. **전체 구독**: `useScheduleContext()`를 호출하면 `schedulesMap` 전체를 구독
2. **전체 리렌더링**: 하나의 시간표가 변경되어도 모든 시간표 컴포넌트가 리렌더링
3. **비효율적 업데이트**: Drop 시 변경된 시간표뿐만 아니라 모든 시간표가 리렌더링됨

## 구현 힌트

### 방법 1: 개별 시간표 구독 훅 생성 (권장)

```typescript
// ScheduleContext.tsx

interface ScheduleContextType {
  schedulesMap: Record<string, Schedule[]>;
  setSchedulesMap: React.Dispatch<React.SetStateAction<Record<string, Schedule[]>>>;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export const useScheduleContext = () => {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error('useScheduleContext must be used within a ScheduleProvider');
  }
  return context;
};

// 특정 시간표만 구독하는 커스텀 훅
export const useSchedule = (tableId: string) => {
  const { schedulesMap, setSchedulesMap } = useScheduleContext();

  // 해당 tableId의 schedules만 메모이제이션
  const schedules = useMemo(
    () => schedulesMap[tableId] || [],
    [schedulesMap, tableId]
  );

  // 해당 tableId의 schedules만 업데이트하는 함수
  const updateSchedules = useCallback(
    (newSchedules: Schedule[] | ((prev: Schedule[]) => Schedule[])) => {
      setSchedulesMap(prev => ({
        ...prev,
        [tableId]: typeof newSchedules === 'function'
          ? newSchedules(prev[tableId] || [])
          : newSchedules
      }));
    },
    [tableId, setSchedulesMap]
  );

  return { schedules, updateSchedules };
};

// 시간표 ID 목록만 구독하는 훅
export const useScheduleIds = () => {
  const { schedulesMap } = useScheduleContext();
  return useMemo(() => Object.keys(schedulesMap), [schedulesMap]);
};

export const ScheduleProvider = ({ children }: PropsWithChildren) => {
  const [schedulesMap, setSchedulesMap] = useState<Record<string, Schedule[]>>(dummyScheduleMap);

  const value = useMemo(
    () => ({ schedulesMap, setSchedulesMap }),
    [schedulesMap]
  );

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
};
```

### 방법 2: Context 분리 (고급)

```typescript
// 시간표 ID 목록, 데이터, 액션을 분리
const ScheduleIdsContext = createContext<string[]>([]);
const ScheduleDataContext = createContext<Record<string, Schedule[]>>({});
const ScheduleActionsContext = createContext<{
  setSchedulesMap: React.Dispatch<React.SetStateAction<Record<string, Schedule[]>>>;
  addSchedule: (tableId: string) => void;
  removeSchedule: (tableId: string) => void;
  duplicateSchedule: (tableId: string) => void;
} | null>(null);

export const ScheduleProvider = ({ children }: PropsWithChildren) => {
  const [schedulesMap, setSchedulesMap] = useState<Record<string, Schedule[]>>(dummyScheduleMap);

  const scheduleIds = useMemo(() => Object.keys(schedulesMap), [schedulesMap]);

  const actions = useMemo(() => ({
    setSchedulesMap,
    addSchedule: (tableId: string) => {
      setSchedulesMap(prev => ({
        ...prev,
        [tableId]: []
      }));
    },
    removeSchedule: (tableId: string) => {
      setSchedulesMap(prev => {
        const { [tableId]: _, ...rest } = prev;
        return rest;
      });
    },
    duplicateSchedule: (targetId: string) => {
      setSchedulesMap(prev => ({
        ...prev,
        [`schedule-${Date.now()}`]: [...prev[targetId]]
      }));
    }
  }), []);

  return (
    <ScheduleIdsContext.Provider value={scheduleIds}>
      <ScheduleDataContext.Provider value={schedulesMap}>
        <ScheduleActionsContext.Provider value={actions}>
          {children}
        </ScheduleActionsContext.Provider>
      </ScheduleDataContext.Provider>
    </ScheduleIdsContext.Provider>
  );
};

// 커스텀 훅들
export const useScheduleIds = () => useContext(ScheduleIdsContext);

export const useScheduleData = (tableId: string) => {
  const schedulesMap = useContext(ScheduleDataContext);
  return useMemo(() => schedulesMap[tableId] || [], [schedulesMap, tableId]);
};

export const useScheduleActions = () => {
  const context = useContext(ScheduleActionsContext);
  if (!context) {
    throw new Error('useScheduleActions must be used within a ScheduleProvider');
  }
  return context;
};
```

### 3. ScheduleTables 컴포넌트 리팩토링

```typescript
// 개별 시간표 래퍼 컴포넌트
interface ScheduleTableWrapperProps {
  tableId: string;
  index: number;
  onOpenSearch: (tableId: string) => void;
}

const ScheduleTableWrapper = memo(({
  tableId,
  index,
  onOpenSearch
}: ScheduleTableWrapperProps) => {
  const { schedules, updateSchedules } = useSchedule(tableId);
  const { duplicateSchedule, removeSchedule } = useScheduleActions();

  const handleDeleteButtonClick = useCallback(
    ({ day, time }: { day: string; time: number }) => {
      updateSchedules(prev =>
        prev.filter(schedule => schedule.day !== day || !schedule.range.includes(time))
      );
    },
    [updateSchedules]
  );

  const handleScheduleTimeClick = useCallback(
    (timeInfo: { day: string; time: number }) => {
      onOpenSearch(tableId);
    },
    [tableId, onOpenSearch]
  );

  const handleDuplicate = useCallback(() => {
    duplicateSchedule(tableId);
  }, [tableId, duplicateSchedule]);

  const handleRemove = useCallback(() => {
    removeSchedule(tableId);
  }, [tableId, removeSchedule]);

  return (
    <Stack width="600px">
      <Heading as="h3" fontSize="lg">시간표 {index + 1}</Heading>
      <ButtonGroup size="sm" isAttached>
        <Button onClick={() => onOpenSearch(tableId)}>시간표 추가</Button>
        <Button colorScheme="green" onClick={handleDuplicate}>복제</Button>
        <Button colorScheme="red" onClick={handleRemove}>삭제</Button>
      </ButtonGroup>
      <ScheduleTable
        tableId={tableId}
        schedules={schedules}
        onScheduleTimeClick={handleScheduleTimeClick}
        onDeleteButtonClick={handleDeleteButtonClick}
      />
    </Stack>
  );
});

ScheduleTableWrapper.displayName = 'ScheduleTableWrapper';

// 메인 컴포넌트
export const ScheduleTables = () => {
  const scheduleIds = useScheduleIds();
  const [searchInfo, setSearchInfo] = useState<{
    tableId: string;
    day?: string;
    time?: number;
  } | null>(null);

  const handleOpenSearch = useCallback((tableId: string) => {
    setSearchInfo({ tableId });
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchInfo(null);
  }, []);

  return (
    <>
      <Wrap spacing={6} p={4}>
        {scheduleIds.map((tableId, index) => (
          <WrapItem key={tableId}>
            <ScheduleTableWrapper
              tableId={tableId}
              index={index}
              onOpenSearch={handleOpenSearch}
            />
          </WrapItem>
        ))}
      </Wrap>

      <SearchDialog
        searchInfo={searchInfo}
        onClose={handleCloseSearch}
      />
    </>
  );
};
```

### 4. ScheduleDndProvider 업데이트

```typescript
export const ScheduleDndProvider = ({ children }: PropsWithChildren) => {
  const { setSchedulesMap } = useScheduleContext();

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    const { x, y } = delta;
    const [tableId, index] = String(active.id).split(':');

    setSchedulesMap(prev => {
      const schedule = prev[tableId][Number(index)];
      const nowDayIndex = DAY_LABELS.indexOf(schedule.day);
      const moveDayIndex = Math.floor(x / CellSize.WIDTH);
      const moveTimeIndex = Math.floor(y / CellSize.HEIGHT);

      return {
        ...prev,
        [tableId]: prev[tableId].map((targetSchedule, targetIndex) => {
          if (targetIndex !== Number(index)) {
            return targetSchedule; // 변경되지 않은 항목은 그대로 반환
          }
          return {
            ...targetSchedule,
            day: DAY_LABELS[nowDayIndex + moveDayIndex],
            range: targetSchedule.range.map(time => time + moveTimeIndex),
          };
        })
      };
    });
  }, [setSchedulesMap]);

  // ... 나머지 구현
};
```

## 기대 효과
- Drop 시 변경된 시간표만 리렌더링
- 전체 앱 리렌더링 방지
- 시간표가 많아져도 성능 유지
- 상태 관리 구조 개선으로 유지보수성 향상

## 검증 방법
1. React DevTools Profiler에서 "Highlight updates" 활성화
2. 시간표 블록 드롭 시 해당 시간표만 깜빡이는지 확인
3. 다른 시간표가 리렌더링되지 않는지 확인
4. 시간표 여러 개 추가 후에도 드롭 성능이 유지되는지 확인

## 주의사항
- Context를 분리할 경우 Provider 중첩 순서에 주의
- `useMemo`와 `useCallback`의 의존성 배열 정확히 설정
- 상태 업데이트 시 불변성 유지

## 참고 자료
- [React Context 최적화](https://react.dev/learn/passing-data-deeply-with-context)
- [상태 관리 최적화 패턴](https://kentcdodds.com/blog/how-to-optimize-your-context-value)
- [useContextSelector RFC](https://github.com/reactjs/rfcs/pull/119)
