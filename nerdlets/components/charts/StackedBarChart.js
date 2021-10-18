import React from 'react'
import PropTypes from 'prop-types'
import { Chart } from 'react-google-charts'
import { Spinner } from 'nr1'

export default class StackedBarChart extends React.PureComponent {
  convertData = () => {
    const { keys, data } = this.props
    const flattenedBuckets = Object.keys(data).map(key => {
      const bucket = data[key]
      const flattened = keys.map(k => bucket[k])
      flattened.unshift(key)
      return flattened
    })
    return flattenedBuckets
  }

  render() {
    const { keys } = this.props
    const data = this.convertData()
    return (
      <Chart
        width
        height={'100%'}
        chartType="ColumnChart"
        loader={<Spinner type={Spinner.TYPE.DOT} />}
        data={[['Actions', ...keys], ...data]}
        options={{
          chartArea: { width: '90%', height: '80%' },
          colors: [
            '#9044b2',
            '#f45632',
            '#fdb819',
            '#219880',
            '#b20071',
            '#3ec9ec',
          ],
          isStacked: true,
          legend: { position: 'top' },
          fontName: 'Open Sans,Segoe UI,Tahoma,sans-serif',
          fontSize: 12,
          hAxis: {
            title: 'Week of',
          },
        }}
        // For tests
        rootProps={{ 'data-testid': '1' }}
      />
    )
  }
}

StackedBarChart.propTypes = {
  keys: PropTypes.array.isRequired,
  data: PropTypes.object.isRequired,
}
