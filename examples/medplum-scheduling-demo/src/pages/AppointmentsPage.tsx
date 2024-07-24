import { Paper, Tabs } from '@mantine/core';
import { Filter, Operator, SearchRequest } from '@medplum/core';
import { MemoizedSearchControl } from '@medplum/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Custom hook to manage the active tab and SearchRequest parameter for the
// MemoizedSearchControl component
function useTab(): [string, (tab: string | null) => void, SearchRequest, (definition: SearchRequest) => void] {
  const upcomingFilter: Filter = {
    code: 'date',
    operator: Operator.STARTS_AFTER,
    value: new Date().toISOString(),
  };
  const pastFilter: Filter = {
    code: 'date',
    operator: Operator.ENDS_BEFORE,
    value: new Date().toISOString(),
  };

  const navigate = useNavigate();
  const { tab } = useParams();
  const [search, updateSearch] = useState<SearchRequest>({
    resourceType: 'Appointment',
    fields: ['patient', 'start', 'end', 'serviceType', '_lastUpdated'],
    filters: [tab === 'upcoming' ? upcomingFilter : pastFilter],
  } as SearchRequest);

  function setSearch(definition: SearchRequest): void {
    updateSearch(definition);
  }

  function changeTab(newTab: string | null): void {
    // Remove date filters keeping others
    const filters = search.filters?.filter((f) => f.code !== 'date');

    // Add the appropriate date filter depending on the active tab
    if (newTab === 'upcoming') {
      navigate('/Appointment/upcoming');
      filters?.push(upcomingFilter);
    } else if (newTab === 'past') {
      navigate('/Appointment/past');
      filters?.push(pastFilter);
    }

    updateSearch({
      ...search,
      filters,
    } as SearchRequest);
  }

  return [tab ?? '', changeTab, search, setSearch];
}

export function AppointmentsPage(): JSX.Element {
  const navigate = useNavigate();
  const [tab, changeTab, search, setSearch] = useTab();

  const tabs = [
    ['upcoming', 'Upcoming'],
    ['past', 'Past'],
  ];

  // Ensure tab is either 'upcoming' or 'past'
  // if it's neither, navigate to the 'upcoming' tab
  useEffect(() => {
    if (!['upcoming', 'past'].includes(tab ?? '')) {
      navigate('/Appointment/upcoming');
    }
  }, [tab, navigate]);

  return (
    <Paper shadow="xs" m="md" p="xs">
      <Tabs value={tab.toLowerCase()} onChange={changeTab}>
        <Tabs.List mb="xs">
          {tabs.map((tab) => (
            <Tabs.Tab value={tab[0]} key={tab[0]}>
              {tab[1]}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      <MemoizedSearchControl
        search={search}
        onClick={() => {}}
        onAuxClick={() => {}}
        onChange={(e) => {
          setSearch(e.definition);
        }}
        checkboxesEnabled={false}
        hideFilters
        hideToolbar
      />
    </Paper>
  );
}
