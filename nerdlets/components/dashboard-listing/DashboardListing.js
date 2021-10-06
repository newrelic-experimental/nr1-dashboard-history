import React from 'react'
import {
  HeadingText,
  Spinner,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell,
  Button,
  Checkbox,
} from 'nr1'
import {
  getSinceClause,
  formatDate,
  formatRelativeDate,
  sameTimeRanges,
} from '../../common/utils/date'
import {
  nerdgraphNrqlQuery,
  entityByTypeQuery,
  accountsQuery,
} from '../../common/utils/query'
import { isEmpty } from '../../common/utils/objects'
import { openDashboard, openHistory } from '../../common/utils/navigation'
import RestoreDashboardModal from '../restore-dashboard/RestoreDashboardModal'
export default class DashboardListing extends React.PureComponent {
  emptyState = {
    loading: true,
    dashboards: {},
    deletedDashboards: {},
    column: 0,
    sortingType: TableHeaderCell.SORTING_TYPE.ASCENDING,
    restoreModalHidden: true,
    restoreModalMounted: false,
    selectedDashboard: null,
    showDeletedOnly: false,
  }

  state = {
    ...this.emptyState,
  }

  componentDidMount() {
    this.loadData()
  }

  componentDidUpdate(prevProps, prevState) {
    if (!this.state.loading) {
      if (
        // there's a bug with the dashboard overlay that causes the timepicker to be reset to be null
        // the timepicker should never be null (there should always be a default), so ignore this behaviour for now
        prevProps.timeRange &&
        this.props.timeRange &&
        !sameTimeRanges(prevProps.timeRange, this.props.timeRange)
      ) {
        this.setState({ ...this.emptyState }, this.loadData())
      }
    }
  }

  loadData = () => {
    this.loadActiveDashboards(null, {}).then(dashboards =>
      this.loadDeletedDashboards(dashboards)
    )
  }

  loadActiveDashboards = async (cursor, dashboards) => {
    console.info('loading active dashboards ...')
    const data = await entityByTypeQuery(cursor, 'DASHBOARD')
    return this.processActiveDashboards(data, dashboards)
  }

  processActiveDashboards = async ({ entities, nextCursor }, dashboards) => {
    entities.reduce((acc, entity) => {
      if (entity.dashboardParentGuid === null) {
        acc[entity.guid] = {
          dashboardGuid: entity.guid,
          dashboardName: entity.name,
          accountId: entity.account.id,
          accountName: entity.account.name,
        }
      }
      return acc
    }, dashboards)

    if (nextCursor) await this.loadActiveDashboards(nextCursor, dashboards)
    else return dashboards
  }

  loadDeletedDashboards = async dashboards => {
    console.info('  ... loading deleted dashboards ...')
    // get the accounts for this user
    const accounts = await accountsQuery()

    const sinceClause = getSinceClause(this.props.timeRange).since
    const deletedDashboardsQuery = `FROM NrAuditEvent SELECT targetId, actorEmail, timestamp WHERE actionIdentifier='dashboard.delete' LIMIT MAX ${sinceClause}`

    // for each account, get the list of deleted dashboards and their name mappings
    Promise.all(
      accounts.map(async ({ id }) => {
        // get the deleted dashboards
        let deletedDashboards = await nerdgraphNrqlQuery(
          id,
          deletedDashboardsQuery
        )

        // trim out any dashboards that may have already been restored (they will appear in the active list)
        deletedDashboards = deletedDashboards.filter(
          dash => !(dash.targetId in dashboards)
        )

        return deletedDashboards
      })
    )
      .then(results => {
        let allDeletedDashboards = []
        results.forEach(result => {
          allDeletedDashboards = allDeletedDashboards.concat(result)
        })
        if (isEmpty(allDeletedDashboards)) {
          console.info('    ... no deleted dashboards found')
          this.setState({ loading: false, dashboards })
        } else {
          console.info('    ... loading deleted dashboard name-guid mappings')
          this.loadNameMappings(
            accounts,
            dashboards,
            allDeletedDashboards,
            sinceClause
          ) // pass everything onto the next step
        }
      })
      .catch(error => {
        console.error('error loading deleted dashboards', error)
        this.setStatus({ loading: false })
      })
  }

  /*
   * We need to run the name mapping lookups in an account agnostic way - meaning that
   * name mappings may be all written into an account scope that is different from the
   * account where the delete event was recorded. If we scope the lookup to the account
   * where the delete occurred, we will not pick up name-mappings that are aggregated into
   * a single (e.g. parent) account scope.
   *
   * Why do we need to do this? In order to collect the name mappings, the user has to run a
   * synthetic script. The user can choose to either manually set up all the account-key mappings
   * and write the mappings into the same scope as the delete events; or they can use one
   * key-account pairing to collect all the mappings into one account. For customers with a lot of
   * accounts, this second configuration is simpler and easier to maintain, but it means we have to
   * decouple the mapping lookup from account scope.
   *
   * If we ever record entity name into the NrAuditEvent table, all of this will be unnecessary.
   */
  loadNameMappings = async (
    accounts,
    dashboards,
    allDeletedDashboards,
    sinceClause
  ) => {
    // extract the guid clause and the deleted details for each deleted dashboard
    let deletedGuidClause = ''
    const deletedDetails = allDeletedDashboards.reduce((acc, deleted, idx) => {
      if (!acc[deleted.targetId]) {
        deletedGuidClause +=
          idx === 0 ? `'${deleted.targetId}'` : `,'${deleted.targetId}'`
        acc[deleted.targetId] = {
          deletedBy: deleted.actorEmail,
          deletedOn: new Date(deleted.timestamp),
        }
      }
      return acc
    }, {})

    const nameMappingQuery = `FROM DashboardGuidNameMap SELECT latest(account) as 'accountId', latest(accountName) as 'accountName', latest(dashboardName) as 'dashboardName' LIMIT MAX ${sinceClause} WHERE dashboardGuid IN (${deletedGuidClause}) facet dashboardGuid`
    Promise.all(
      accounts.map(async ({ id }) => {
        const mappings = await nerdgraphNrqlQuery(id, nameMappingQuery)
        console.debug('mappings', id, mappings)
        const nameMappings = mappings.reduce((acc, mapping) => {
          acc[mapping.dashboardGuid] = {
            dashboardGuid: mapping.dashboardGuid,
            dashboardName: mapping.dashboardName,
            accountId: mapping.accountId,
            accountName: mapping.accountName,
            ...deletedDetails[mapping.dashboardGuid],
          }
          return acc
        }, {})

        return nameMappings
      })
    )
      .then(results => {
        console.info('finished loading data')
        let deletedDashboards = {}
        results.forEach(result => {
          dashboards = { ...dashboards, ...result }
          deletedDashboards = { ...deletedDashboards, ...result }
        })
        this.setState({ loading: false, dashboards, deletedDashboards })
      })
      .catch(error => {
        console.error('error loading dashboard names', error)
        this.setStatus({ loading: false })
      })
  }

  handleClickRestore = dashboard =>
    this.setState({
      restoreModalHidden: false,
      restoreModalMounted: true,
      selectedDashboard: dashboard,
    })
  handleCloseRestoreModal = (evt, dashboard) => {
    if (dashboard) {
      const { dashboards, deletedDashboards } = this.state
      const restored = dashboards[dashboard.dashboardGuid]
      restored.deletedOn = null
      restored.deletedBy = null
      delete deletedDashboards[dashboard.dashboardGuid]
    }

    this.setState({
      restoreModalHidden: true,
      selectedDashboard: null,
    })
  }
  handleHideRestoreModal = () => this.setState({ restoreModalMounted: false })

  handleTableSort(column, evt, { nextSortingType }) {
    if (column === this.state.column) {
      this.setState({ sortingType: nextSortingType })
    } else {
      this.setState({
        column: column,
        sortingType: nextSortingType,
      })
    }
  }

  handleFilterDeleted = () =>
    this.setState({ showDeletedOnly: !this.state.showDeletedOnly })

  renderTable = () => {
    const { dashboards, deletedDashboards, showDeletedOnly } = this.state
    const data = showDeletedOnly ? deletedDashboards : dashboards

    return (
      <Table items={Object.values(data)}>
        <TableHeader>
          <TableHeaderCell
            sortable
            sortingType={
              this.state.column === 0
                ? this.state.sortingType
                : TableHeaderCell.SORTING_TYPE.NONE
            }
            onClick={this.handleTableSort.bind(this, 0)}
            value={({ item }) => item.dashboardName}
            width="2fr"
          >
            Dashboard Name
          </TableHeaderCell>
          <TableHeaderCell
            sortable
            sortingType={
              this.state.column === 1
                ? this.state.sortingType
                : TableHeaderCell.SORTING_TYPE.NONE
            }
            onClick={this.handleTableSort.bind(this, 1)}
            value={({ item }) => item.accountName}
            width="1.5fr"
          >
            Account Name
          </TableHeaderCell>
          <TableHeaderCell
            sortable
            sortingType={
              this.state.column === 2
                ? this.state.sortingType
                : TableHeaderCell.SORTING_TYPE.NONE
            }
            onClick={this.handleTableSort.bind(this, 2)}
            value={({ item }) => item.deletedBy}
            width="1.5fr"
          >
            Deleted By
          </TableHeaderCell>
          <TableHeaderCell
            sortable
            sortingType={
              this.state.column === 3
                ? this.state.sortingType
                : TableHeaderCell.SORTING_TYPE.NONE
            }
            onClick={this.handleTableSort.bind(this, 3)}
            value={({ item }) => item.deletedOn}
          >
            Deleted On
          </TableHeaderCell>
          <TableHeaderCell></TableHeaderCell>
        </TableHeader>
        {({ item }) => (
          <TableRow>
            <TableRowCell>{item.dashboardName}</TableRowCell>
            <TableRowCell>{item.accountName}</TableRowCell>
            <TableRowCell>{item.deletedBy}</TableRowCell>
            <TableRowCell>
              {item.deletedOn && formatDate(item.deletedOn)}
            </TableRowCell>
            <TableRowCell>
              <div className="button-row">
                <Button
                  sizeType={Button.SIZE_TYPE.SMALL}
                  onClick={() =>
                    item.deletedBy
                      ? this.handleClickRestore(item)
                      : openDashboard(item.dashboardGuid)
                  }
                >
                  {item.deletedBy ? 'Restore' : 'View'}
                </Button>
                <Button
                  sizeType={Button.SIZE_TYPE.SMALL}
                  onClick={() => openHistory(item)}
                >
                  History
                </Button>
              </div>
            </TableRowCell>
          </TableRow>
        )}
      </Table>
    )
  }

  render() {
    const {
      loading,
      restoreModalHidden,
      restoreModalMounted,
      selectedDashboard,
    } = this.state
    const { timeRange } = this.props

    return (
      <>
        <div className="base-container">
          <div className="base-container-top-section">
            <div>
              <HeadingText type={HeadingText.TYPE.HEADING_2}>
                Dashboard Listings
              </HeadingText>
              <HeadingText
                className="sub-heading_date"
                type={HeadingText.TYPE.HEADING_5}
              >
                {formatRelativeDate(timeRange)}
              </HeadingText>
            </div>
            <div className="dashboard-listing-filter-container">
              <Checkbox
                onChange={this.handleFilterDeleted}
                label="Only Deleted Dashboards"
              />
            </div>
          </div>
          {loading && <Spinner />}
          {!loading && <div className="base-table">{this.renderTable()}</div>}
        </div>
        {!restoreModalHidden && restoreModalMounted && (
          <RestoreDashboardModal
            hidden={this.state.restoreModalHidden}
            onClose={this.handleCloseRestoreModal}
            onHideEnd={this.handleHideRestoreModal}
            dashboard={selectedDashboard}
          />
        )}
      </>
    )
  }
}
