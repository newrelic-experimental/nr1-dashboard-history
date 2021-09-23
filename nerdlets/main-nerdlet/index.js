import React from 'react'
import {
  nerdlet,
  AutoSizer,
  PlatformStateContext,
  NerdletStateContext,
  Layout,
  LayoutItem,
} from 'nr1'
import DashboardListing from '../components/dashboard-listing/DashboardListing'

export default class Wrapper extends React.Component {
  componentDidMount() {
    nerdlet.setConfig({
      accountPicker: true,
    })
  }

  render() {
    return (
      <PlatformStateContext.Consumer>
        {({ timeRange, accountId }) => (
          <NerdletStateContext.Consumer>
            {nerdletUrlState => (
              <AutoSizer>
                {({ width, height }) => (
                  <div
                    style={{
                      width,
                      height,
                      overflowX: 'hidden',
                    }}
                  >
                    <Layout fullHeight={true}>
                      <LayoutItem type={LayoutItem.TYPE.MAIN}>
                        <DashboardListing
                          accountId={accountId}
                          timeRange={timeRange}
                        />
                      </LayoutItem>
                    </Layout>
                  </div>
                )}
              </AutoSizer>
            )}
          </NerdletStateContext.Consumer>
        )}
      </PlatformStateContext.Consumer>
    )
  }
}
