import { navigation } from 'nr1'

export const openDashboard = guid => {
  navigation.openStackedEntity(guid)
}

export const openHistory = dashboard => {
  navigation.openStackedNerdlet({
    id: 'dashboard-change-history',
    urlState: { dashboard },
  })
}
