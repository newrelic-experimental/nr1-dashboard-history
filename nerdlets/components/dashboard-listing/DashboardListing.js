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
  entityByTypeQuery,
  accountsQuery,
} from '../../common/utils/query'
import { isEmpty } from '../../common/utils/objects'
import { openDashboard, openHistory } from '../../common/utils/navigation'
import RestoreDashboardModal from '../restore-dashboard/RestoreDashboardModal'
import SearchResults from './SearchResults'
export default class DashboardListing extends React.PureComponent {
  emptyState = {
    loading: true,
    dashboards: {},
    pages: {},
    deletedDashboards: {},
    filteredDashboards: null,
    column: 0,
    sortingType: TableHeaderCell.SORTING_TYPE.ASCENDING,
    restoreModalHidden: true,
    restoreModalMounted: false,
    selectedDashboard: null,
    showDeletedOnly: false,
    searchAutoComplete: null,
    searchValue: '',
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
        prevProps.timeRange &&
        this.props.timeRange &&
        !sameTimeRanges(prevProps.timeRange, this.props.timeRange)
      ) {
        this.setState({ ...this.emptyState }, this.loadData())
      }
    }
  }

  loadData = () => {
    this.loadActiveDashboards(null, {}, {}).then(({ dashboards, pages }) =>
      this.loadDeletedDashboards(dashboards, pages)
    )
  }

  loadActiveDashboards = async (cursor, dashboards, pages) => {
    console.info('loading active dashboards ...')
    const data = await entityByTypeQuery(cursor, 'DASHBOARD')
    return this.processActiveDashboards(data, dashboards, pages)
  }

  processActiveDashboards = async (
    { entities, nextCursor },
    dashboards,
    pages
  ) => {
    entities.reduce((acc, entity) => {
      if (entity.dashboardParentGuid === null) {
        acc[entity.guid] = {
          dashboardGuid: entity.guid,
          dashboardName: entity.name,
          accountId: entity.account.id,
          accountName: entity.account.name,
        }
      } else {
        if (pages[entity.dashboardParentGuid])
          pages[entity.dashboardParentGuid].push(entity.guid)
        else pages[entity.dashboardParentGuid] = [entity.guid]
      }
      return acc
    }, dashboards)

    if (nextCursor)
      await this.loadActiveDashboards(nextCursor, dashboards, pages)
    else return { dashboards, pages }
  }

  loadDeletedDashboards = async (dashboards, pages) => {
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
          this.setState({ loading: false, dashboards, pages })
        } else {
          console.info('    ... loading deleted dashboard name-guid mappings')
          this.loadNameMappings(
            accounts,
            dashboards,
            pages,
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

  loadNameMappings = async (
    accounts,
    dashboards,
    pages,
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
        this.setState({
          loading: false,
          dashboards,
          pages,
          deletedDashboards,
        })
      })
      .catch(error => {
        console.error('error loading dashboard names', error)
        this.setStatus({ loading: false })
      })
  }

  handleRefreshData = () =>
    this.setState({ ...this.emptyState }, () => this.loadData())

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

  getSearchResults = value => {
    const searchTerm = value.toLowerCase()
    const { dashboards } = this.state
    const matches = Object.values(dashboards).reduce((acc, dashboard) => {
      const name = dashboard.dashboardName
      if (name.toLowerCase().includes(searchTerm)) {
        if (!acc[name]) acc[name] = []
        acc[name].push(dashboard.dashboardGuid)
      }
      return acc
    }, {})
    this.setState({ searchAutoComplete: matches })
  }
  handleSearchChange = ({ target: { value } }) => {
    this.getSearchResults(value)
  }
  handleSearchFocus = ({ target: { value } }) => {
    if (value) this.getSearchResults(value)
  }
  handleSearchSelect = (name, guids) => {
    const { dashboards } = this.state
    const filteredDashboards = guids.reduce((acc, guid) => {
      acc[guid] = { ...dashboards[guid] }
      return acc
    }, {})
    this.setState({
      searchAutoComplete: null,
      searchValue: name,
      filteredDashboards,
      showDeletedOnly: false,
    })
  }
  handleClearSearchValue = () =>
    this.setState({ searchValue: '', filteredDashboards: null })
  handleCloseSearchResults = () => this.setState({ searchAutoComplete: null })

  renderTable = () => {
    const {
      dashboards,
      pages,
      deletedDashboards,
      filteredDashboards,
      showDeletedOnly,
    } = this.state
    const data = showDeletedOnly
      ? deletedDashboards
      : filteredDashboards
      ? filteredDashboards
      : dashboards

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
                  onClick={() => openHistory(item, pages[item.dashboardGuid])}
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
      searchAutoComplete,
      searchValue,
      showDeletedOnly,
    } = this.state
    const { timeRange } = this.props

    return (
      <>
        <div className="base-container">
          <div className="base-container-top-section">
            <div>
              <div className="dashboard-listing-main-header">
                <HeadingText type={HeadingText.TYPE.HEADING_2}>
                  Dashboard Listings
                </HeadingText>
                <Button
                  iconType={Button.ICON_TYPE.INTERFACE__OPERATIONS__REFRESH}
                  onClick={() => this.handleRefreshData()}
                />
              </div>
              <HeadingText
                className="sub-heading_date"
                type={HeadingText.TYPE.HEADING_5}
              >
                {formatRelativeDate(timeRange)}
              </HeadingText>
            </div>
            <div className="dashboard-listing-filter-container">
              <div className="search-input">
                {searchValue ? (
                  <div className="search__selected">
                    <div className="search__selected-item">{searchValue}</div>
                    <div
                      className="search__selected-remove"
                      onClick={this.handleClearSearchValue}
                    >
                      X
                    </div>
                  </div>
                ) : (
                  <TextField
                    className="search-input__text-field"
                    type={TextField.TYPE.SEARCH}
                    placeholder="Start typing to search for a dashboard"
                    onChange={this.handleSearchChange}
                    onFocus={this.handleSearchFocus}
                    autoFocus={true}
                  />
                )}
                {searchAutoComplete && (
                  <SearchResults
                    results={searchAutoComplete}
                    closeOnClickOutside={this.handleCloseSearchResults}
                    onSelectItem={this.handleSearchSelect}
                  />
                )}
              </div>
              <Checkbox
                checked={showDeletedOnly}
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
