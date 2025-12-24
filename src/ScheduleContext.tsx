import React, { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from "react";
import { Schedule } from "./types.ts";
import dummyScheduleMap from "./dummyScheduleMap.ts";

interface ScheduleContextType {
  schedulesMap: Record<string, Schedule[]>;
  setSchedulesMap: React.Dispatch<React.SetStateAction<Record<string, Schedule[]>>>;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export const useScheduleContext = () => {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
};

// 특정 시간표만 구독하는 커스텀 훅
export const useSchedule = (tableId: string) => {
  const { schedulesMap, setSchedulesMap } = useScheduleContext();

  const schedules = useMemo(
    () => schedulesMap[tableId] || [],
    [schedulesMap, tableId]
  );

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
