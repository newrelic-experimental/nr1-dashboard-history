import React from 'react'
import PropTypes from 'prop-types'

import {
  nerdlet,
  HeadingText,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell,
  Spinner,
  Button,
  NerdGraphQuery,
  AreaChart,
} from 'nr1'
import { formatDate } from '../../common/utils/date'
import { nerdgraphNrqlQuery } from '../../common/utils/query'
import { openDashboard } from '../../common/utils/navigation'
import RestoreDashboardModal from '../restore-dashboard/RestoreDashboardModal'

export default class ViewHistory extends React.Component {
  state = {
    since: ' 13 months ago',
    loading: true,
    allEventsData: [],
    eventActionData: [],
    restoreModalHidden: true,
    restoreModalMounted: false,
    refreshDashboard: false,
  }

  componentDidMount() {
    this.loadData()
  }

  componentDidUpdate(prevProps, prevState) {
    const { loading, refreshDashboard } = this.state
    if (!loading && refreshDashboard) {
      this.setState({ loading: true }, () => this.loadData())
    }
  }

  loadData = async () => {
    console.info('loading single dashboard event data')
    const { since } = this.state
    const { dashboard } = this.props

    const data = await nerdgraphNrqlQuery(
      dashboard.accountId,
      `SELECT timestamp, actionIdentifier, actorEmail FROM NrAuditEvent SINCE ${since} WHERE targetId = '${dashboard.dashboardGuid}' LIMIT MAX`,
      NerdGraphQuery.FETCH_POLICY_TYPE.NO_CACHE
    )

    this.setState({
      allEventsData: data,
      loading: false,
      refreshDashboard: false,
    })
  }

  handleClickRestore = () =>
    this.setState({
      restoreModalHidden: false,
      restoreModalMounted: true,
    })
  handleCloseRestoreModal = (evt, dashboard) => {
    if (dashboard) {
      dashboard.deletedBy = null
      dashboard.deletedOn = null
      this.setState(
        {
          restoreModalHidden: true,
          refreshDashboard: true,
        },
        () => {
          nerdlet.setUrlState({ dashboard })
        }
      )
    }

    this.setState({
      restoreModalHidden: true,
    })
  }
  handleHideRestoreModal = () => this.setState({ restoreModalMounted: false })

  renderTable = data => {
    return (
      <Table items={data}>
        <TableHeader>
          <TableHeaderCell>User</TableHeaderCell>
          <TableHeaderCell>Change Date</TableHeaderCell>
          <TableHeaderCell>Change Action</TableHeaderCell>
        </TableHeader>
        {({ item }) => (
          <TableRow>
            <TableRowCell>{item.actorEmail}</TableRowCell>
            <TableRowCell>{formatDate(item.timestamp)}</TableRowCell>
            <TableRowCell>{item.actionIdentifier}</TableRowCell>
          </TableRow>
        )}
      </Table>
    )
  }

  render() {
    const { dashboard } = this.props
    const {
      loading,
      allEventsData,
      since,
      restoreModalHidden,
      restoreModalMounted,
    } = this.state

    if (loading) return <Spinner />
    return (
      <>
        <div className="base-container">
          <div className="base-container-top-section">
            <div>
              <HeadingText type={HeadingText.TYPE.HEADING_2}>
                Dashboard Change History &gt; {dashboard.dashboardName}
              </HeadingText>
              <HeadingText
                className="sub-heading_date"
                type={HeadingText.TYPE.HEADING_5}
              >
                Since 13 months ago (max available data)
              </HeadingText>
            </div>
            <div className="button-row">
              <Button
                type={Button.TYPE.PRIMARY}
                onClick={() =>
                  dashboard.deletedBy
                    ? this.handleClickRestore(dashboard)
                    : openDashboard(dashboard.dashboardGuid)
                }
              >
                {dashboard.deletedBy ? 'Restore' : 'View'}
              </Button>
            </div>
          </div>
          <div className="base-container">
            {allEventsData.length > 0 ? (
              <div className="history-container">
                <div className="history-chart-container">
                  <AreaChart
                    fullWidth
                    style={{ height: '250rem' }}
                    query={`SELECT count(*) FROM NrAuditEvent SINCE ${since} WHERE targetId = '${dashboard.dashboardGuid}' FACET actionIdentifier TIMESERIES LIMIT MAX`}
                    accountId={dashboard.accountId}
                  />
                </div>
                <div className="history-chart-container">
                  <div className="base-table">
                    {this.renderTable(allEventsData)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-header">No History Found</div>
                <div className="empty-state-desc">
                  Sorry, we couldn't find any change records for the selected
                  dashboard. This is either because the last modification
                  happened more than 13 months ago; or this is a child
                  dashboard.
                </div>
              </div>
            )}
          </div>
        </div>
        {!restoreModalHidden && restoreModalMounted && (
          <RestoreDashboardModal
            hidden={this.state.restoreModalHidden}
            onClose={this.handleCloseRestoreModal}
            onHideEnd={this.handleHideRestoreModal}
            dashboard={dashboard}
          />
        )}
      </>
    )
  }
}

ViewHistory.propTypes = {
  dashboard: PropTypes.object.isRequired,
}
