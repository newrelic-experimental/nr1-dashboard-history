/* 
This script will generate a Custom Event (DashboardGuidNameMap) to map Dashboard GUIDs to their names, in support of the Dashboard Change History NR1 App.

Use this script to collect all dashboard name mappings in a single account. 

BE AWARE: The scope of accounts included is defined by the specified USER_KEY.

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
  PARENT_ACCOUNT: { id: 0, key: '' },

  /* The New Relic USER key. This will define the accessible scope of data.
   */
  READ_KEY: '',
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
// 1. Get the list of accounts to include and initiate the lookups.
// ######

const accountQuery = `{
  actor {
    accounts(scope: IN_REGION) {
      id
    }
  }
}`

const accountQueryTransformer = accounts => {
  return {
    accounts: accounts.map(account => `'${account.id}'`).join(),
    cursor: undefined,
    dashboardMappings: [],
  }
}
const getAccounts = () =>
  read(
    accountQuery,
    {},
    accountQueryExtractor,
    accountQueryTransformer,
    getNamedDashboards
  )

// ######
// 2. Retrieve the complete set of active dashboards
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

const getNamedDashboards = ({ accounts, cursor, dashboardMappings }) => {
  console.info('reading current dashboards...')
  const query = `type in ('DASHBOARD') and accountId IN (${accounts})`

  const entityToEventTransformer = results => {
    dashboardMappings = dashboardMappings.concat(
      results.entities.map(entity => nameMappingEventBuilder(entity))
    )
    return { accounts, cursor: results.nextCursor, dashboardMappings }
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
// 3. Create a custom event to associate the dashboard name to the guid
// ######

const storeNamedDashboards = ({ dashboardMappings }) => {
  console.info('posting dashboard mappings')
  const requestOptions = {
    uri: `https://insights-collector.newrelic.com/v1/accounts/${constants.PARENT_ACCOUNT.id}/events`,
    headers: { 'X-Insert-Key': constants.PARENT_ACCOUNT.key },
    json: true,
    body: dashboardMappings,
  }
  if (dashboardMappings.length > 0) {
    $http.post(requestOptions, (error, response, body) => {
      if (!error && response.statusCode == 200)
        console.log(`Posted ${dashboardMappings.length} dashboard mappings`)
      else {
        console.log(`Error posting to insights`)
        console.error('error', error)
        console.info('response status code', response.statusCode)
        console.info('body', body)
      }
    })
  }
}

// ######
// Run the mapping functions for each required account
// ######
getAccounts()
