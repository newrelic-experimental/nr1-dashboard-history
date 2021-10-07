/* 
This script will generate a Custom Event (DashboardGuidNameMap) to map Dashboard GUIDs to their names, in support of the Dashboard Change History NR1 App.

Set up:
To use this script, you need to create a Synthetic API monitor. For more information on creating the appropriate Synthetic Monitor, see https://docs.newrelic.com/docs/synthetics/synthetic-monitoring/scripting-monitors/write-synthetic-api-tests/
This script requires that you have both a New Relic License Key and a New Relic User Key. For more information on New Relic keys: https://docs.newrelic.com/docs/apis/intro-apis/new-relic-api-keys/

Recommendations:
- modify this script to use Secure Credentials to store and access the key values required. Learn more about Secure Credentials here: https://docs.newrelic.com/docs/synthetics/synthetic-monitoring/using-monitors/store-secure-credentials-scripted-browsers-api-tests/
*/

// Constants required by this script.
const constants = {
  /* A mapping of the target New Relic account ids and their LICENSE keys.
   */
  ACCOUNTS: [{ id: 0, key: '' }],
  /* The New Relic USER key. This will define the accessible scope of data.
   * The set of target accounts is defined by the ACCOUNT mappings; however, this USER key must have access to all accounts listed in the ACCOUNTS mapping.
   */
  READ_KEY: '',
  NR_MAX_PAYLOAD_SIZE: 1000 * 1024,
}

const accountQueryExtractor = body => {
  return body.data.actor.accounts
}

const entityQueryExtractor = body => {
  return body.data.actor.entitySearch.results
}

const read = (
  query,
  variables,
  resultsExtractor,
  resultsTransformer,
  callback
) => {
  const requestOptions = {
    uri: 'https://api.newrelic.com/graphql',
    headers: { Accept: 'application/json', 'X-Api-Key': constants.READ_KEY },
    body: { query, variables },
    json: true,
  }

  $http.post(requestOptions, (error, response, body) => {
    // console.info('response body for query ', variables.query, JSON.stringify(body))
    if (!error && response.statusCode == 200) {
      callback(resultsTransformer(resultsExtractor(body)))
    } else console.error(`An error occurred: ${error ? error : body}`)
  })
}

// ######
// 1. Retrieve the complete set of active dashboards
// ######

const dashboardEntityQuery = `query dashboardEntityQuery($cursor:String,$query:String!) {
    actor {
      entitySearch(query: $query) {
        results(cursor: $cursor) {
          entities {
            account {
              id
              name
            }
            guid
            name
            ... on DashboardEntityOutline {
              dashboardParentGuid
            }
          }
          nextCursor
        }
      }
    }
  }`

const nameMappingEventBuilder = entity => {
  return {
    eventType: 'DashboardGuidNameMap',
    account: entity.account.id,
    accountName: entity.account.name,
    dashboardGuid: entity.guid,
    dashboardName: entity.name,
  }
}

const nextStep = transformed => {
  return transformed.cursor !== null
    ? getNamedDashboards(transformed)
    : storeNamedDashboards(transformed)
}

const payloadSizeIsOk = (current, addition) =>
  JSON.stringify(current).length + JSON.stringify(addition).length <
  constants.NR_MAX_PAYLOAD_SIZE

const getNamedDashboards = ({ account, cursor, dashboardMappings }) => {
  console.info(`${account.id}: reading current dashboards... cursor: ${cursor}`)
  const query = `type in ('DASHBOARD') and accountId=${account.id}`

  const entityToEventTransformer = results => {
    results.entities.forEach(entity => {
      if (entity.dashboardParentGuid === null) {
        const event = nameMappingEventBuilder(entity)
        const activeItem = dashboardMappings[dashboardMappings.length - 1]

        if (payloadSizeIsOk(activeItem, event)) {
          activeItem.push(event)
        } else {
          dashboardMappings.push([event])
        }
      }
    })
    return { account, cursor: results.nextCursor, dashboardMappings }
  }

  read(
    dashboardEntityQuery,
    { cursor: cursor === undefined ? null : cursor, query },
    entityQueryExtractor,
    entityToEventTransformer,
    nextStep
  )
}

// ######
// 2. Create a custom event to associate the dashboard name to the guid
// ######

const getPostOptions = (payload, postOptions) => {
  let options = { ...postOptions }
  options['body'] = payload
  return options
}

const storeNamedDashboards = ({ account, dashboardMappings }) => {
  console.info('posting dashboard mappings to account', account.id)

  const postOptions = {
    uri: `https://insights-collector.newrelic.com/v1/accounts/${account.id}/events`,
    headers: { 'X-Insert-Key': account.key },
    json: true,
  }

  if (dashboardMappings.length > 0) {
    console.info(
      `${account.id}: total dashboardMappings payload batches ${dashboardMappings.length}`
    )
    dashboardMappings.forEach(mapping => {
      console.info('payload batch total events', mapping.length)

      $http.post(
        getPostOptions(mapping, postOptions),
        (error, response, body) => {
          if (!error && response.statusCode == 200)
            console.log(
              `Posted ${mapping.length} dashboard mapping events to account ${account.id}`
            )
          else {
            console.log(`Error posting to insights`)
            console.error('error', error)
            console.info('response status code', response.statusCode)
            console.info('body', body)
          }
        }
      )
    })
  }
}

// ######
// Run the mapping functions for each required account
// ######

constants.ACCOUNTS.forEach(account =>
  getNamedDashboards({ account, cursor: undefined, dashboardMappings: [[]] })
)
