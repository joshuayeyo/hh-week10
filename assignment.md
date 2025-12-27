# 1. 저장소 세팅

https://github.com/hanghae-plus/front_7th_chapter4-2

1. 성능 개선이 필요한 가상의 프로젝트를 `fork`한다음 `clone`하여 작업해주세요.
2. 필요한 패키지를 설치하여 로컬 개발환경을 준비해주세요.

```bash
# 먼저 pnpm을 설치합니다.
$ npm install -g pnpm

# 프로젝트에 필요한 패키지를 설치합니다.
$ pnpm install
```

# 2. 저장소 파악하기

- 과제로 제시된 저장소에 구현된 요구사항은 다음과 같습니다.
  1. 시간표에서 수업을 검색할 수 있습니다.
  2. 검색에 대한 다양한 조건을 선택할 수 있습니다.
  3. 검색 결과는 인피니티 스크롤을 통해서 가져옵니다.
  4. 등록한 수업을 DnD(Drag and Drop)로 옮길 수 있습니다.
  5. 등록한 수업을 삭제할 수 있습니다.
  6. 시간표를 복제할 수 있습니다.
- 어플리케이션을 직접 실행해봅시다.

```bash
# 어플리케이션 실행
pnpm run dev
```

[화면 기록 2024-08-17 오전 6.04.06.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/b128cfc4-fcb2-4d8d-819e-c303df9af9eb/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%8C%E1%85%A5%E1%86%AB_6.04.06.mov)

- 현재는 다음과 같은 성능 저하 지점이 있습니다.
  1. 수업 검색 모달 내 검색 결과를 보여주는 리스트에서 페이지네이션이 느립니다.
  2. 똑같은 API를 계속 호출합니다.
  3. 시간표에서 드래그/드롭으로 과목에 해당하는 블럭을 옮길 수 있지만 무척 느립니다.
  4. 시간표가 많아질수록 렌더링이 기하급수적으로 느려집니다.

# 3. React Devtools 설치

[React Developer Tools - Chrome 웹 스토어](https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi?hl=ko)

[화면 기록 2024-08-17 오후 12.24.35.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/5cc360d3-1d9d-43db-a0df-2078aaec72ca/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_12.24.35.mov)

# 4. 성능 개선 목표

[화면 기록 2024-08-17 오후 2.16.23.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/2ea3e249-2779-44d7-829b-59473218f75e/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_2.16.23.mov)

- 과제를 통해 개선해야 하는 부분은 다음과 같습니다.
  1. 페이지네이션을 했을 때 발생하는 렌더링 + 불필요한 연산 최소화
  2. 드래그/드롭 시점에 발생하는 렌더링 + 불필요한 연산 최소화

## (1) 기본과제: SearchDialog.tsx 개선

### 1) API 호출 부분을 최적화주세요

```jsx
const fetchMajors = () => axios.get<Lecture[]>('/schedules-majors.json');
const fetchLiberalArts = () => axios.get<Lecture[]>('/schedules-majors.json');

// TODO: 이 코드를 개선해서 API 호출을 최소화 해보세요 + Promise.all이 현재 잘못 사용되고 있습니다. 같이 개선해주세요.
const fetchAllLectures = async () => await Promise.all([
  (console.log('API Call 1', performance.now()), await fetchMajors()),
  (console.log('API Call 2', performance.now()), await fetchLiberalArts()),
  (console.log('API Call 3', performance.now()), await fetchMajors()),
  (console.log('API Call 4', performance.now()), await fetchLiberalArts()),
  (console.log('API Call 5', performance.now()), await fetchMajors()),
  (console.log('API Call 6', performance.now()), await fetchLiberalArts()),
]);
```

![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/de972179-dc1f-47c4-8931-fe963bd458fe/image.png)

- Promise.all과 관련된 코드를 보면 병렬로 실행될 것 같지만 실제로 직렬로 실행되고 있습니다.
  (**API Call 6의 호출 시점**과 **모든 API 호출 완료 시점**이 거의 동일)
  정상적으로 동작하도록 변경해주세요. - 병렬로 실행될 경우
          ![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/ce1561e7-8419-4af6-bf7c-da196b3173e7/image.png)

          (**API Call 1의 시점**과 **API Call 6의 시점**이 거의 차이가 없음)

- 이미 호출한 API는 다시 호출하지 않도록 시도해보세요. (힌트: 클로저를 이용해서 캐시를 구성하면 됩니다.)
  - API 호출을 캐시할 경우, **대략 20ms 정도 개선된걸 볼 수 있습니다.**
    ![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/1fa05b00-15aa-4d4d-8320-037e1143bbb9/image.png)

### 2) 불필요한 연산이 발생하지 않도록 해주세요

```jsx
// TODO: 이 컴포넌트에서 불필요한 연산이 발생하지 않도록 다양한 방식으로 시도해주세요.
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
        if (days.length === 0) {
          return true;
        }
        const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
        return schedules.some(s => days.includes(s.day));
      })
      .filter(lecture => {
        if (times.length === 0) {
          return true;
        }
        const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
        return schedules.some(s => s.range.some(time => times.includes(time)));
      });
  }

  const filteredLectures = getFilteredLectures();
  const lastPage = Math.ceil(filteredLectures.length / PAGE_SIZE);
  const visibleLectures = filteredLectures.slice(0, page * PAGE_SIZE);
  const allMajors = [...new Set(lectures.map(lecture => lecture.major))];

  /*뒤의 내용 생략*/
}
```

[화면 기록 2024-08-17 오후 1.03.55.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/23359a76-522b-4f69-8e06-83376ec01790/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_1.03.55.mov)

![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/822f6fc3-0e17-4ea3-9131-b2b167d5703f/image.png)

- 지금은 렌더링을 할 때 마다 (인피니트 스크롤을 할 때 마다) 검색을 다시 하고 있습니다. **최초에 한 번 검색한 이후에는 검색을 다시 하지 않도록 만들어주세요**
- 개선된 모습의 프로파일링입니다.
  [화면 기록 2024-08-17 오후 1.05.38.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/4fe241b2-4c9a-4a53-a58b-2cb92fabf124/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_1.05.38.mov)

### 3) 불필요한 렌더링 방지

![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/eb76f4f0-e13c-439b-ad94-32fd02d5ad73/image.png)

- 렌더링 비용이 많이 발생하는 컴포넌트가 존재합니다. 불필요하게 렌더링이 되지 않도록 개선해주세요.
  - 전공 목록을 조회하는 컴포넌트에서 모든 요소가 리렌더링 되고 있습니다.
    ![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/a43d3417-fbad-4ad1-84dd-c0df2ac356ba/image.png)
    ![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/d268025e-d2b0-4e59-858a-593fbbfaa913/image.png)
    대략 30ms
  - 강의 목록을 조회하는 컴포넌트의 경우, 내부 요소에 대해 전부 렌더링이 실행되고 있습니다. 스크롤을 내리면 내릴수록 렌더링 비용이 많이 발생합니다.
    [화면 기록 2024-08-17 오후 1.32.17.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/695adc41-7e46-4e10-9e5d-bd511d7e5c60/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_1.32.17.mov)
    - 페이지네이션을 통해서 데이터를 가져올 때 마다, 모든 요소를 다시 렌더링 하고 있습니다.
    - 가령, **검색 결과가 대략 3000개이고, 마지막 결과를 조회하기 위해 30페이지까지 갈 경우**, tbody에서만 600ms 정도 소요됩니다.
  - **최적화 후에 프로파일링을 하면 추가되는 컴포넌트에 대해서만 렌더링이 되는 모습을 볼 수 있습니다.**
    [화면 기록 2024-08-17 오후 1.29.47.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/d45722de-2dae-4755-9b3a-98def3599226/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_1.29.47.mov)

<aside>
💡 **과제 외적으로 시도해보면 좋은 것**

- 지금은 검색을 할 때, 데이터를 모두 가져온 다음에 렌더링을 하고 있습니다.
  - 가령, 당장 렌더링에 필요한건 100개의 데이터인데 검색을 통해서 수천개의 데이터를 가져옵니다.
- 그렇다면 반대로 렌더링에 필요한 데이터만 가져올 수 있도록 하는 방법은 없을까요? - “지연평가” 라는 키워드를 토대로 찾아보면 알 수 있답니다!
</aside>

## (2) 심화과제: DnD 시스템 개선

[화면 기록 2024-08-17 오전 6.13.29.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/358c91d9-49dc-404d-87b0-fa4f94e6106b/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%8C%E1%85%A5%E1%86%AB_6.13.29.mov)

### 1) 드래그시 렌더링 최적화

![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/bba60be8-ee93-4f71-97ee-11b6918f3cb7/image.png)

- 드래그를 할 때 거의 모든 요소가 리렌더링 되고 있습니다.
  - 상태관리에 대한 부분을 리팩토링 할 경우 해결이 가능합니다.
    - 힌트) useDndContext
  - **메모이제이션을 적절하게 사용**하여 불필요한 렌더링이 발생하지 않도록 해주세요.
    [화면 기록 2024-08-17 오후 1.42.00.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/24dcea55-9684-4ae1-a9df-44d04b462c03/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_1.42.00.mov)

### 2) Drop을 했을 때 렌더링 최적화

[화면 기록 2024-08-17 오후 12.26.44.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/b3f982cf-3ffb-426f-b6ae-7729a1bfd1a6/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_12.26.44.mov)

![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/47ce3218-82b2-427c-87a7-4c6d251b956b/image.png)

- 모든 구간이 schedulesMap을 의존하고 있습니다. 그래서 schedulesMap이 업데이트 되면 모든 컴포넌트가 업데이트 되는 형태입니다. (실제로는 한 개의 Schedule만 업데이트 되고 있지만, 모든 Schedule Data가 업데이트 된것으로 인지하게 됩니다.)
  ```jsx
  // schedulesMap이 큰 덩어리로 관리되고 있고, 이걸 사용할 경우 렌더링이 빈번하게 발생합니다.
  export const ScheduleProvider = ({ children }: PropsWithChildren) => {
    const [schedulesMap, setSchedulesMap] = useState<Record<string, Schedule[]>>(dummyScheduleMap);

    return (
      <ScheduleContext.Provider value={{ schedulesMap, setSchedulesMap }}>
        {children}
      </ScheduleContext.Provider>
    );
  };
  ```
- 전역상태를 업데이트하거나 가져오는 방식을 개선하고 메모이제이션을 적절하게 사용할 경우, Drop을 했을 때에 불필요한 렌더링을 방지할 수 있습니다.
  [화면 기록 2024-08-17 오후 2.12.33.mov](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/c7d80254-1e5c-4d20-a748-6306b7a48393/%E1%84%92%E1%85%AA%E1%84%86%E1%85%A7%E1%86%AB_%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8_2024-08-17_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_2.12.33.mov)
  ![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/83c75a39-3aba-4ba4-a792-7aefe4b07895/9825ddf6-2620-4c1f-9e8a-9f097b1db382/image.png)

# 5. 프로젝트 배포

gh-pages 를 이용해서 배포해주세요.

예시)

[시간표 제작 서비스로 학습하는 성능최적화](https://hanghae-plus.github.io/front_7th_chapter4-2/)

# 6. 제출

- Pull Request를 생성한 후, PR 링크를 제출합니다.
