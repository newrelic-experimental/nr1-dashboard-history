import { navigation } from 'nr1'

export const openDashboard = guid => {
  navigation.openStackedNerdlet({
    id: 'dashboards.detail',
    urlState: { entityGuid: guid },
  })
}
