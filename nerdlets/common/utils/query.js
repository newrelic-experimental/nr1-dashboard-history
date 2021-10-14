import { AccountsQuery, EntitiesByDomainTypeQuery, NerdGraphQuery } from 'nr1'

export const accountsQuery = async () => {
  console.debug('calling accountsQuery')
  try {
    const { data } = await AccountsQuery.query()
    return data
  } catch (error) {
    console.error('error with accountsQuery query', error)
    return []
  }
}

const nerdgraphNrqlGql = `query($id:Int!,$query:Nrql!) {
  actor {
    account(id: $id) {
      nrql(query: $query) {
        results
      }
    }
  }
}`

export const nerdgraphNrqlQuery = async (
  accountId,
  nrql,
  fetchPolicy = NerdGraphQuery.FETCH_POLICY_TYPE.NETWORK_ONLY
) => {
  console.debug('calling nerdgraphNrqlQuery', accountId, nrql)

  const variables = {
    id: accountId,
    query: nrql,
  }

  try {
    const { data, errors } = await NerdGraphQuery.query({
      query: nerdgraphNrqlGql,
      variables,
      fetchPolicyType: fetchPolicy,
    })

    if (errors) console.error('error returned by nerdgraph query', errors)
    else return data.actor.account.nrql.results
  } catch (e) {
    console.error('error with nerdgraph query', e)
    console.info('error with nerdgraph query', variables)
    return []
  }
}

export const entityByDomainTypeQuery = async (cursor, domain, type) => {
  console.debug('calling entityByDomainTypeQuery', cursor, domain, type)
  try {
    const { data } = await EntitiesByDomainTypeQuery.query({
      cursor,
      entityDomain: domain,
      entityType: type,
    })
    return data
  } catch (error) {
    console.error('error with entityByDomainType query', error)
    return []
  }
}

const entityByTypeGql = `query($type:String!,$cursor:String){
  actor {
    entitySearch(query:$type) {
      results(cursor:$cursor) {
        entities {
          name
          guid
          account {
            id
            name
          }
          ... on DashboardEntityOutline {
            dashboardParentGuid
          }
        }
        nextCursor
      }
    }
  }
}`
export const entityByTypeQuery = async (
  cursor = null,
  type,
  fetchPolicy = NerdGraphQuery.FETCH_POLICY_TYPE.NETWORK_ONLY
) => {
  console.debug('calling entityByTypeQuery', cursor, type)

  const variables = {
    type: `type IN ('${type}')`,
    cursor: cursor,
  }

  try {
    const { data, errors } = await NerdGraphQuery.query({
      query: entityByTypeGql,
      variables: variables,
      fetchPolicyType: fetchPolicy,
    })
    if (errors) console.error('error returned by nerdgraph query', errors)
    else return data.actor.entitySearch.results
  } catch (error) {
    console.error('error with entityByType query', error)
    return []
  }
}
