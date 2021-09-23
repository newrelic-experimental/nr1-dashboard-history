import { AccountsQuery, EntitiesByDomainTypeQuery, NerdGraphQuery } from 'nr1'

export const accountsQuery = async () => {
  console.debug('accountsQuery')
  try {
    const { data } = await AccountsQuery.query()
    return data
  } catch (error) {
    console.error('error with accountsQuery query', error)
    return []
  }
}

export const nerdgraphNrqlQuery = async (accountId, nrql) => {
  console.debug('nerdgraphNrqlQuery', accountId, nrql)

  const query = `{
    actor {
      account(id: ${accountId}) {
        nrql(query: "${nrql}") {
          results
        }
      }
    }
  }`

  try {
    const { data } = await NerdGraphQuery.query({ query })
    // console.debug(data?.actor.account)
    return data?.actor.account.nrql.results
  } catch (e) {
    console.error('error with nerdgraph query', e)
    console.info('error with nerdgraph query', variables)
    return []
  }
}

export const entityByDomainTypeQuery = async (cursor, domain, type) => {
  console.debug('entityByDomainTypeQuery', cursor, domain, type)
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
