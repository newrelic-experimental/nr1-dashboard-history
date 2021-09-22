import React, { Component } from 'react'
import {
  HeadingText,
  Spinner,
  EntitiesByDomainTypeQuery,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell,
} from 'nr1'

export default class DashboardListing extends Component {
  emptyState = {
    loading: true,
    activeDashboards: [],
    column: 0,
    sortingType: TableHeaderCell.SORTING_TYPE.NONE,
  }

  state = {
    ...this.emptyState,
  }

  componentDidMount() {
    this.loadActiveDashboards(null, {})
  }

  loadActiveDashboards = async (cursor, dashboards) => {
    const { data } = await EntitiesByDomainTypeQuery.query({
      cursor,
      entityDomain: 'VIZ',
      entityType: 'DASHBOARD',
    })
    this.processActiveDashboards(data, dashboards)
  }

  processActiveDashboards = async ({ entities, nextCursor }, dashboards) => {
    dashboards = entities.reduce((acc, entity) => {
      acc.push({
        dashboardGuid: entity.guid,
        dashboardName: entity.name,
        accountId: entity.account.id,
        accountName: entity.account.name,
      })
      return acc
    }, [])
    if (nextCursor) await this.loadActiveDashboards(nextCursor, dashboards)
    else
      this.setState({
        loading: false,
        activeDashboards: dashboards,
      })
  }

  handleColumnSort(column, evt, { nextSortingType }) {
    if (column === this.state.column) {
      this.setState({ sortingType: nextSortingType })
    } else {
      this.setState({
        column: column,
        sortingType: nextSortingType,
      })
    }
  }

  renderTable = data => (
    <Table items={data}>
      <TableHeader>
        <TableHeaderCell
          sortable
          sortingType={
            this.state.column === 0
              ? this.state.sortingType
              : TableHeaderCell.SORTING_TYPE.NONE
          }
          onClick={this.handleColumnSort.bind(this, 0)}
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
          onClick={this.handleColumnSort.bind(this, 1)}
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
          onClick={this.handleColumnSort.bind(this, 2)}
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
          onClick={this.handleColumnSort.bind(this, 3)}
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
          <TableRowCell></TableRowCell>
          <TableRowCell></TableRowCell>
          <TableRowCell></TableRowCell>
        </TableRow>
      )}
    </Table>
  )

  render() {
    const { loading, activeDashboards } = this.state
    return (
      <div className="dashboard-listing-container">
        <HeadingText type={HeadingText.TYPE.HEADING_2}>
          Dashboard Listings
        </HeadingText>
        {loading && <Spinner />}
        {!loading && (
          <div className="dashboard-listing-table">
            {this.renderTable(activeDashboards)}
          </div>
        )}
      </div>
    )
  }
}
