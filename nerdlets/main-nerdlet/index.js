import React from 'react'
import {
  AutoSizer,
  PlatformStateContext,
  NerdletStateContext,
  Layout,
  LayoutItem,
} from 'nr1'
import DashboardListing from '../components/dashboard-listing/DashboardListing'

export default class Wrapper extends React.Component {
  render() {
    return (
      <PlatformStateContext.Consumer>
        {({ timeRange }) => (
          <NerdletStateContext.Consumer>
            {nerdletUrlState => (
              <AutoSizer>
                {({ width, height }) => (
                  <div style={{ width, height, overflowX: 'hidden' }}>
                    <Layout fullHeight={true}>
                      <LayoutItem type={LayoutItem.TYPE.MAIN}>
                        <DashboardListing />
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
