import React from 'react'
import { AutoSizer, NerdletStateContext, Layout, LayoutItem } from 'nr1'
import ViewHistory from '../components/view-dashboard-history/ViewHistory'

export default class Wrapper extends React.PureComponent {
  render() {
    return (
      <NerdletStateContext.Consumer>
        {nerdletUrlState => {
          return (
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
                      <ViewHistory
                        dashboard={nerdletUrlState.dashboard}
                        pages={nerdletUrlState.pages}
                      />
                    </LayoutItem>
                  </Layout>
                </div>
              )}
            </AutoSizer>
          )
        }}
      </NerdletStateContext.Consumer>
    )
  }
}
