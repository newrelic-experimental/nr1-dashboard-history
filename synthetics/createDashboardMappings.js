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

const getNamedDashboards = ({ account, cursor, dashboardMappings }) => {
  const query = `type in ('DASHBOARD') and accountId=${account.id}`

  const entityToEventTransformer = results => {
    dashboardMappings = dashboardMappings.concat(
      results.entities.map(entity => nameMappingEventBuilder(entity))
    )
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

const storeNamedDashboards = ({ account, dashboardMappings }) => {
  const requestOptions = {
    uri: `https://insights-collector.newrelic.com/v1/accounts/${account.id}/events`,
    headers: { 'X-Insert-Key': account.key },
    json: true,
    body: dashboardMappings,
  }

  if (dashboardMappings.length > 0) {
    $http.post(requestOptions, (error, response, body) => {
      if (!error && response.statusCode == 200)
        console.log(`Posted ${dashboardMappings.length} dashboard mappings`)
      else console.log(`Error posting to insights: ${error ? error : body}`)
    })
  }
}

// ######
// Run the mapping functions for each required account
// ######
constants.ACCOUNTS.forEach(account =>
  getNamedDashboards({ account, cursor: undefined, dashboardMappings: [] })
)
