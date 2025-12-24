# Issue #4: 시간표 블록 드래그시 렌더링 최적화

## Labels
`심화과제`, `performance`, `DnD`

## 목표
- 드래그 중 불필요한 컴포넌트 리렌더링 방지
- `useDndContext` 사용 최적화

## 작업 내용
- [ ] `ScheduleTable` 컴포넌트 `React.memo` 적용
- [ ] `DraggableSchedule` 컴포넌트 `React.memo` 적용
- [ ] `useDndContext` 사용 최적화 (필요한 값만 구독)
- [ ] 드래그 상태 관련 로직 분리 (커스텀 훅)
- [ ] 콜백 함수들 `useCallback` 적용

## 관련 파일
- `src/ScheduleTable.tsx` (라인 49-60, 139)
- `src/ScheduleDndProvider.tsx`

## 현재 문제 코드

```typescript
// ScheduleTable.tsx
const ScheduleTable = ({ tableId, schedules, onScheduleTimeClick, onDeleteButtonClick }: Props) => {
  // 문제: useDndContext를 사용하면 드래그 상태 변경 시 전체 컴포넌트가 리렌더링됨
  const dndContext = useDndContext();

  const getActiveTableId = () => {
    const activeId = dndContext.active?.id;
    if (activeId) {
      return String(activeId).split(":")[0];
    }
    return null;
  }

  const activeTableId = getActiveTableId();

  // activeTableId가 변경될 때마다 전체 테이블이 리렌더링됨
  return (
    <Box
      position="relative"
      outline={activeTableId === tableId ? "5px dashed" : undefined}
      outlineColor="blue.300"
    >
      {/* 전체 그리드 및 스케줄 컴포넌트들 */}
    </Box>
  );
};
```

### 문제점 분석
1. **전체 리렌더링**: `useDndContext`가 드래그 상태 변경 시 전체 컴포넌트를 리렌더링
2. **불필요한 계산**: 모든 시간표가 `activeTableId`를 계산함
3. **컴포넌트 분리 부재**: 드래그 상태에 의존하는 부분과 아닌 부분이 분리되지 않음

## 구현 힌트

### 1. 활성 테이블 ID 로직 분리 (커스텀 훅)

```typescript
// hooks/useActiveTableId.ts
import { useDndContext } from '@dnd-kit/core';
import { useMemo } from 'react';

export const useActiveTableId = () => {
  const { active } = useDndContext();

  return useMemo(() => {
    if (active?.id) {
      return String(active.id).split(":")[0];
    }
    return null;
  }, [active?.id]);
};
```

### 2. 테이블 테두리 래퍼 컴포넌트 분리

```typescript
// 드래그 상태에만 반응하는 래퍼 컴포넌트
interface TableBorderWrapperProps {
  tableId: string;
  children: React.ReactNode;
}

const TableBorderWrapper = memo(({ tableId, children }: TableBorderWrapperProps) => {
  const activeTableId = useActiveTableId();

  return (
    <Box
      position="relative"
      outline={activeTableId === tableId ? "5px dashed" : undefined}
      outlineColor="blue.300"
    >
      {children}
    </Box>
  );
});

TableBorderWrapper.displayName = 'TableBorderWrapper';
```

### 3. DraggableSchedule 메모이제이션

```typescript
interface DraggableScheduleProps {
  id: string;
  lecture: Lecture;
  day: string;
  range: number[];
  room?: string;
  bg: string;
  onDeleteButtonClick: () => void;
}

const DraggableSchedule = memo(({
  id,
  lecture,
  day,
  range,
  room,
  bg,
  onDeleteButtonClick
}: DraggableScheduleProps) => {
  const { attributes, setNodeRef, listeners, transform } = useDraggable({ id });

  const leftIndex = DAY_LABELS.indexOf(day);
  const topIndex = range[0] - 1;
  const size = range.length;

  return (
    <Popover>
      <PopoverTrigger>
        <Box
          position="absolute"
          left={`${120 + (CellSize.WIDTH * leftIndex) + 1}px`}
          top={`${40 + (topIndex * CellSize.HEIGHT + 1)}px`}
          width={(CellSize.WIDTH - 1) + "px"}
          height={(CellSize.HEIGHT * size - 1) + "px"}
          bg={bg}
          p={1}
          boxSizing="border-box"
          cursor="pointer"
          ref={setNodeRef}
          transform={CSS.Translate.toString(transform)}
          {...listeners}
          {...attributes}
        >
          <Text fontSize="sm" fontWeight="bold">{lecture.title}</Text>
          <Text fontSize="xs">{room}</Text>
        </Box>
      </PopoverTrigger>
      <PopoverContent onClick={(e) => e.stopPropagation()}>
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverBody>
          <Text>강의를 삭제하시겠습니까?</Text>
          <Button colorScheme="red" size="xs" onClick={onDeleteButtonClick}>
            삭제
          </Button>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
});

DraggableSchedule.displayName = 'DraggableSchedule';
```

### 4. ScheduleTable 메모이제이션

```typescript
interface ScheduleTableProps {
  tableId: string;
  schedules: Schedule[];
  onScheduleTimeClick?: (timeInfo: { day: string; time: number }) => void;
  onDeleteButtonClick?: (timeInfo: { day: string; time: number }) => void;
}

// 내부 그리드 컴포넌트 (드래그 상태와 무관)
const ScheduleTableContent = memo(({
  tableId,
  schedules,
  onScheduleTimeClick,
  onDeleteButtonClick
}: ScheduleTableProps) => {
  const getColor = useCallback((lectureId: string): string => {
    const lectureIds = [...new Set(schedules.map(({ lecture }) => lecture.id))];
    const colors = ["#fdd", "#ffd", "#dff", "#ddf", "#fdf", "#dfd"];
    return colors[lectureIds.indexOf(lectureId) % colors.length];
  }, [schedules]);

  const handleCellClick = useCallback((day: string, time: number) => {
    onScheduleTimeClick?.({ day, time });
  }, [onScheduleTimeClick]);

  const handleDeleteClick = useCallback((day: string, time: number) => {
    onDeleteButtonClick?.({ day, time });
  }, [onDeleteButtonClick]);

  return (
    <Grid
      templateColumns={`120px repeat(${DAY_LABELS.length}, ${CellSize.WIDTH}px)`}
      templateRows={`40px repeat(${TIMES.length}, ${CellSize.HEIGHT}px)`}
      bg="white"
      fontSize="sm"
      textAlign="center"
      outline="1px solid"
      outlineColor="gray.300"
    >
      {/* 그리드 헤더 */}
      <GridItem borderColor="gray.300" borderWidth="1px" bg="gray.100">
        <Flex justifyContent="center" alignItems="center" h="full" w="full">
          <Text fontWeight="bold">교시</Text>
        </Flex>
      </GridItem>

      {DAY_LABELS.map((day) => (
        <GridItem key={day} borderColor="gray.300" borderWidth="1px" bg="gray.100">
          <Flex justifyContent="center" alignItems="center" h="full" w="full">
            <Text fontWeight="bold">{day}</Text>
          </Flex>
        </GridItem>
      ))}

      {/* 시간 슬롯 */}
      {TIMES.map((time, timeIndex) => (
        <Fragment key={`row-${timeIndex}`}>
          <GridItem borderColor="gray.300" borderWidth="1px" bg="gray.100">
            <Flex justifyContent="center" alignItems="center" h="full" w="full">
              <Text fontSize="xs">{formatTime(time)}</Text>
            </Flex>
          </GridItem>

          {DAY_LABELS.map((day) => (
            <GridItem
              key={`${day}-${timeIndex}`}
              borderColor="gray.300"
              borderWidth="1px"
              cursor="pointer"
              _hover={{ bg: 'yellow.100' }}
              onClick={() => handleCellClick(day, timeIndex + 1)}
            />
          ))}
        </Fragment>
      ))}

      {/* 스케줄 오버레이 */}
      {schedules.map(({ lecture, day, range, room }, index) => (
        <DraggableSchedule
          key={`${tableId}:${index}`}
          id={`${tableId}:${index}`}
          lecture={lecture}
          day={day}
          range={range}
          room={room}
          bg={getColor(lecture.id)}
          onDeleteButtonClick={() => handleDeleteClick(day, range[0])}
        />
      ))}
    </Grid>
  );
});

ScheduleTableContent.displayName = 'ScheduleTableContent';

// 외부에서 사용하는 컴포넌트
export const ScheduleTable = memo((props: ScheduleTableProps) => {
  return (
    <TableBorderWrapper tableId={props.tableId}>
      <ScheduleTableContent {...props} />
    </TableBorderWrapper>
  );
});

ScheduleTable.displayName = 'ScheduleTable';
```

## 기대 효과
- 드래그 중 해당 시간표만 리렌더링
- 다른 시간표 및 관련 없는 컴포넌트 리렌더링 방지
- 드래그 성능 대폭 향상

## 검증 방법
1. React DevTools Profiler에서 "Highlight updates" 활성화
2. 드래그 시 드래그 중인 시간표만 깜빡이는지 확인
3. 다른 시간표가 리렌더링되지 않는지 확인
4. Profiler에서 드래그 중 렌더링 시간 측정

## 주의사항
- `useDndContext`는 드래그 상태 변경마다 리렌더링을 유발함
- 드래그 상태에 의존하는 부분을 최소화하고 분리해야 함
- `memo`와 `useCallback`을 함께 사용해야 효과적

## 참고 자료
- [@dnd-kit 공식 문서](https://docs.dndkit.com/)
- [useDndContext API](https://docs.dndkit.com/api-documentation/context-provider#usedndcontext)
- [React 렌더링 최적화](https://react.dev/reference/react/memo)
