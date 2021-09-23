import dayjs from 'dayjs'
const relativeTime = require('dayjs/plugin/relativeTime')

export const getSinceClause = timeRange => {
  const { begin_time, end_time, duration } = timeRange
  let clauses = { timeRange }

  if (duration) {
    const minutes = duration / 1000 / 60
    clauses.since = ` SINCE ${minutes} MINUTES AGO `
  } else if (begin_time && end_time) {
    clauses.since = ` SINCE ${begin_time} UNTIL ${end_time} `
  } else {
    clauses.since = ' SINCE 60 MINUTES AGO '
  }

  return clauses
}

export const formatDate = (date, pattern = 'MMM D, YYYY HH:mm:ss') => {
  return dayjs(date).format(pattern)
}

export const formatRelativeDate = timeRange => {
  const { begin_time, end_time, duration } = timeRange

  if (duration) {
    dayjs.extend(relativeTime)
    const formatted = dayjs().to(dayjs().subtract(duration, 'ms'))
    return `Since ${formatted}`
  } else if (begin_time && end_time) {
    return `Since ${dayjs(begin_time).format('MMM DD hh:mm')} Until ${dayjs(
      end_time
    ).format('MMM DD hh:mm')}`
  } else {
    return 'Since 60 minutes ago'
  }
}
