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
} from 'nr1'
import { formatDate } from '../../common/utils/date'
import { nerdgraphNrqlQuery } from '../../common/utils/query'
import { openDashboard } from '../../common/utils/navigation'
import { arrayToCommaDelimited } from '../../common/utils/objects'
import RestoreDashboardModal from '../restore-dashboard/RestoreDashboardModal'
import StackedBarChart from '../charts/StackedBarChart'

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

  getGuidsClause = () => {
    const { dashboard, pages } = this.props
    return pages
      ? `IN (${arrayToCommaDelimited([dashboard.dashboardGuid, ...pages])})`
      : `= '${dashboard.dashboardGuid}'`
  }

  loadData = async () => {
    const { since } = this.state
    const { dashboard, pages } = this.props
    console.info(
      'loading dashboard',
      dashboard.dashboardName,
      dashboard.dashboardGuid
    )

    const data = await nerdgraphNrqlQuery(
      dashboard.accountId,
      `SELECT timestamp, actionIdentifier, actorEmail FROM NrAuditEvent SINCE ${since} WHERE targetId ${this.getGuidsClause()} LIMIT MAX`,
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

  prepStackedBarData = data => {
    const keys = {
      keys: [],
      addKey(key) {
        if (!this.keys.includes(key)) this.keys.push(key)
      },
      mappedKeys: {
        'dashboard.create': 'Create',
        'dashboard.delete': 'Delete',
        'dashboard.undelete': 'Undelete',
        'dashboard.update': 'Update',
        'dashboard.add_widgets': 'Add Widgets',
        'dashboard.update_page': 'Update Page',
      },
    }
    const buckets = data.reduce((acc, result) => {
      const week = formatDate(result.beginTimeSeconds * 1000, 'MMM-DD')
      const action = keys.mappedKeys[result.actionIdentifier]
      keys.addKey(action)
      if (acc[week]) {
        if (acc[week][action]) {
          const currTotal = acc[week][action]
          acc[week][action] = currTotal + result.count
        } else {
          acc[week][action] = result.count
        }
      } else {
        acc[week] = {
          [action]: result.count,
        }
      }
      return acc
    }, {})
    return { keys: keys.keys, buckets }
  }

  render() {
    const { dashboard, pages } = this.props
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
            {!dashboard.deletedBy && (
              <div className="button-row">
                {/* <Button
                type={Button.TYPE.PRIMARY}
                onClick={() =>
                  dashboard.deletedBy
                    ? this.handleClickRestore(dashboard)
                    : openDashboard(dashboard.dashboardGuid)
                }
              >
                {dashboard.deletedBy ? 'Restore' : 'View'}
              </Button> */}
                <Button
                  type={Button.TYPE.PRIMARY}
                  onClick={() => openDashboard(dashboard.dashboardGuid)}
                >
                  View
                </Button>
              </div>
            )}
          </div>
          <div className="base-container">
            {allEventsData.length > 0 ? (
              <div className="history-container">
                <div className="history-chart-container">
                  <NerdGraphQuery
                    query={`{
                      actor {
                        account(id: ${dashboard.accountId}) {
                          nrql(query: "SELECT count(*) FROM NrAuditEvent SINCE ${since} WHERE targetId ${this.getGuidsClause()} FACET actionIdentifier TIMESERIES 1 WEEK") {
                            results
                          }
                        }
                      }
                    }`}
                    // fetchPolicyType={NerdGraphQuery.FETCH_POLICY_TYPE.NO_CACHE}
                  >
                    {({ loading, error, data }) => {
                      if (loading) return <Spinner />

                      if (error)
                        console.error(
                          'error loading dashboard event history',
                          error
                        )

                      const { keys, buckets } = this.prepStackedBarData(
                        data.actor.account.nrql.results
                      )
                      return <StackedBarChart keys={keys} data={buckets} />
                    }}
                  </NerdGraphQuery>
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
  pages: PropTypes.object,
}
