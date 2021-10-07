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

export default class Wrapper extends React.PureComponent {
  componentDidMount() {
    nerdlet.setConfig({
      accountPicker: true,
      timePicker: true,
      timePickerRanges: [
        {
          label: '60 minutes',
          offset: 1000 * 60 * 60,
        },
        {
          label: '3 hours',
          offset: 1000 * 60 * 60 * 3,
        },
        {
          label: '6 hours',
          offset: 1000 * 60 * 60 * 6,
        },
        {
          label: '12 hours',
          offset: 1000 * 60 * 60 * 12,
        },
        {
          label: '24 hours',
          offset: 1000 * 60 * 60 * 24,
        },
        {
          label: '3 days',
          offset: 1000 * 60 * 60 * 24 * 3,
        },
        {
          label: '7 days',
          offset: 1000 * 60 * 60 * 24 * 7,
        },
        {
          label: '15 days',
          offset: 1000 * 60 * 60 * 24 * 15,
        },
        {
          label: '30 days',
          offset: 1000 * 60 * 60 * 24 * 30,
        },
        {
          label: '1 year',
          offset: 1000 * 60 * 60 * 24 * 365,
        },
        {
          label: '2 years',
          offset: 1000 * 60 * 60 * 24 * 365 * 2,
        },
        nerdlet.TIME_PICKER_RANGE.CUSTOM,
      ],
      timePickerDefaultOffset: 1000 * 60 * 60 * 24 * 7,
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
