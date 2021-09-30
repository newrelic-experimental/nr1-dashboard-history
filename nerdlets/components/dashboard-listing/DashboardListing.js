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
  TextField,
} from 'nr1'
import { startCase } from 'lodash'
import {
  getSinceClause,
  formatDate,
  formatRelativeDate,
  sameTimeRanges,
} from '../../common/utils/date'
import {
  nerdgraphNrqlQuery,
  entityByDomainTypeQuery,
  accountsQuery,
} from '../../common/utils/query'
import { openDashboard } from '../../common/utils/navigation'
import RestoreDashboardModal from '../restore-dashboard/RestoreDashboardModal'
import SearchResults from './SearchResults'

const FILTERABLE_ATTRIBUTES = ['dashboardName', 'accountName', 'deletedBy']
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
    searchAutoComplete: null,
    activeFilter: {},
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
    const data = await entityByDomainTypeQuery(cursor, 'VIZ', 'DASHBOARD')
    return this.processActiveDashboards(data, dashboards)
  }

  processActiveDashboards = async ({ entities, nextCursor }, dashboards) => {
    entities.reduce((acc, entity) => {
      acc[entity.guid] = {
        dashboardGuid: entity.guid,
        dashboardName: entity.name,
        accountId: entity.account.id,
        accountName: entity.account.name,
      }
      return acc
    }, dashboards)

    if (nextCursor) await this.loadActiveDashboards(nextCursor, dashboards)
    else return dashboards
  }

  loadDeletedDashboards = async dashboards => {
    // get the accounts for this user
    const accounts = await accountsQuery()

    const sinceClause = getSinceClause(this.props.timeRange).since
    const deletedDashboardsQuery = `FROM NrAuditEvent SELECT targetId, actorEmail, timestamp WHERE actionIdentifier='dashboard.delete' LIMIT MAX ${sinceClause}`
    let nameMappingQuery = `FROM DashboardGuidNameMap SELECT account as 'accountId', accountName, dashboardGuid, dashboardName LIMIT MAX ${sinceClause}`

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

        // if any deleted are found, get their name mappings
        if (deletedDashboards && deletedDashboards.length > 0) {
          let targetGuids = ''
          const deletedDetails = deletedDashboards.reduce(
            (acc, deleted, idx) => {
              targetGuids +=
                idx === 0 ? `'${deleted.targetId}'` : `,'${deleted.targetId}'`
              acc[deleted.targetId] = {
                deletedBy: deleted.actorEmail,
                deletedOn: new Date(deleted.timestamp),
              }
              return acc
            },
            {}
          )

          nameMappingQuery += ` WHERE dashboardGuid IN (${targetGuids})`
          const mappings = await nerdgraphNrqlQuery(id, nameMappingQuery)
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
        }
        return null
      })
    )
      .then(results => {
        let deletedDashboards = {}
        results.forEach(result => {
          dashboards = { ...dashboards, ...result }
          deletedDashboards = { ...deletedDashboards, ...result }
        })
        this.setState({
          loading: false,
          dashboards,
          deletedDashboards,
        })
      })
      .catch(error => console.error('error loading dashboard names', error))
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
    this.setState({
      showDeletedOnly: !this.state.showDeletedOnly,
    })

  handleSearchChange = ({ target: { value } }) => {
    this.getSearchResults(value)
  }
  handleSearchFocus = ({ target: { value } }) => {
    if (value) this.getSearchResults(value)
  }
  getSearchResults = value => {
    const searchTerm = value.toLowerCase()
    const { dashboards } = this.state
    const matches = Object.values(dashboards).reduce((acc, dashboard) => {
      FILTERABLE_ATTRIBUTES.forEach(attribute => {
        if (dashboard[attribute]?.toLowerCase().includes(searchTerm)) {
          const displayName = startCase(attribute)
          const exists = acc[displayName]?.find(
            item => item.displayValue === dashboard[attribute]
          )
          if (!exists) {
            if (!acc[displayName]) acc[displayName] = []
            acc[displayName].push({
              displayValue: dashboard[attribute],
              dashboardGuid: dashboard.dashboardGuid,
            })
          }
        }
      })
      return acc
    }, {})
    console.info('search matches', matches)
    this.setState({ searchAutoComplete: matches })
  }
  handleFilterSelect = value => {}
  handleCloseSearchResults = () => {
    this.setState({ searchAutoComplete: null })
  }

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
                      : openDashboard(item.dashboardGuid, this.props.timeRange)
                  }
                >
                  {item.deletedBy ? 'Restore' : 'View'}
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
      searchAutoComplete,
    } = this.state
    const { timeRange } = this.props

    return (
      <>
        <div className="dashboard-listing-container">
          <div className="dashboard-listing-top-section-container">
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
              <div className="search-input">
                <TextField
                  className="search-input__text-field"
                  type={TextField.TYPE.SEARCH}
                  placeholder="Start typing to search for account, dashboard or user names"
                  onChange={this.handleSearchChange}
                  onFocus={this.handleSearchFocus}
                  autoFocus={true}
                />
                {searchAutoComplete && (
                  <SearchResults
                    results={searchAutoComplete}
                    closeOnClickOutside={this.handleCloseSearchResults}
                    onSelectItem={this.handleFilterSelect}
                  />
                )}
              </div>
              <Checkbox
                onChange={this.handleFilterDeleted}
                label="Only Deleted Dashboards"
              />
            </div>
          </div>
          {loading && <Spinner />}
          {!loading && (
            <div className="dashboard-listing-table">{this.renderTable()}</div>
          )}
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
