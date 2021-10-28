import { navigation } from 'nr1'

export const openDashboard = guid => {
  navigation.openStackedNerdlet({
    id: 'dashboards.detail',
    urlState: { entityGuid: guid, useDefaultTimeRange: false },
  })
}

export const openHistory = (dashboard, pages) => {
  navigation.openStackedNerdlet({
    id: 'dashboard-change-history',
    urlState: { dashboard, pages },
  })
}
