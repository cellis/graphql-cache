/* eslint-env mocha */

import {expect} from 'chai'
import gql from 'graphql-tag'
import {print} from 'graphql-tag/printer'
import {cacheQueryResult, passThroughQuery, queryCache} from '../../../'
import {cacheKey} from '../../../util'
import {normalizeEntities} from '../index'

describe('middleware/normalize-entities', function () {

  describe('cacheQueryResult', function () {
    it('should normalize entities in a simple query', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
          }

          otherUser {
            id
            name
          }
        }
      `

      const result = {
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
        otherUser: null,
      }

      const previousCache = {}
      const cache = cacheQueryResult(previousCache, query, result, null, normalizeEntities)

      expect(cache).to.eql({
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
        user: {
          id: '10',
        },
        otherUser: null,
      })
    })

    it('should normalize entities in a complex query', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth

            friends(first: 3) {
              user {
                id
                name
              }
            }

            nestedUser {
              id
              about
            }
          }

          someOtherUser {
            id
            interests
          }
        }
      `

      const result = {
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          friends: [
            {
              user: {
                id: '11',
                name: 'Person 1',
              },
            },
            {
              user: {
                id: '12',
                name: 'Person 2',
              },
            },
          ],
          nestedUser: {
            id: '10',
            about: 'Same user inside itself.',
          },
        },
        someOtherUser: {
          id: '10',
          interests: 'What?!',
        },
      }

      const previousCache = {}
      const cache = cacheQueryResult(previousCache, query, result, null, normalizeEntities)

      expect(cache).to.eql({
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          interests: 'What?!',
          about: 'Same user inside itself.',
          [cacheKey('friends', { first: 3 })]: [
            { user: { id: '11' } },
            { user: { id: '12' } },
          ],
          nestedUser: {
            id: '10',
          },
        },
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 1',
        },
        [cacheKey('node', { id: '12' })]: {
          id: '12',
          name: 'Person 2',
        },
        user: {
          id: '10',
        },
        someOtherUser: {
          id: '10',
        },
      })
    })
  })

  describe('passThroughQuery', function () {
    it('should take a simple cache state with normalized entities and query and remove unnecessary fields', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
            interests
            about
            location {
              address { street { name } }
            }
          }

          otherUser {
            id
            name
          }
        }
      `

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          interests: 'Hi',
        },
        user: {
          id: '10',
        },
      }

      const newQuery = print(passThroughQuery(cache, query, null, normalizeEntities))

      expect(newQuery).to.equal(print(gql`
        query {
          user {
            id
            dateOfBirth
            about
            location {
              address { street { name } }
            }
          }
          otherUser {
            id
            name
          }
        }
      `))
    })

    it('should take a simple cache state and query and return null if all data requested is in cache', function () {
      const query = gql`
        query {
          user(id: $userId) {
            id
            name
            dateOfBirth
            friend {
              id
              name
            }
          }
        }
      `

      const variables = { userId: '10' }

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          friend: {
            id: '11',
          },
        },
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 1',
        },
        [cacheKey('user', { id: '10' })]: {
          id: '10',
        },
      }

      const newQuery = passThroughQuery(cache, query, variables, normalizeEntities)

      expect(newQuery).to.be.null
    })

    it('should take a simple cache state with normalized entities and query with variables and remove unnecessary fields', function () {
      const query = gql`
        query {
          user(id: $userId) {
            id
            name
            dateOfBirth
            interests
            about
            friend {
              id
              name
            }
          }

          otherUser {
            id
            name
          }
        }
      `

      const variables = { userId: '10' }

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          interests: 'Hi',
          friend: {
            id: '11',
          },
        },
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 1',
        },
        [cacheKey('user', { id: '10' })]: {
          id: '10',
        },
      }

      const newQuery = print(passThroughQuery(cache, query, variables, normalizeEntities))

      expect(newQuery).to.equal(print(gql`
        query {
          user(id: $userId) {
            id
            dateOfBirth
            about
          }
          otherUser {
            id
            name
          }
        }
      `))
    })

    it('should take a cache state and query with fragments and remove unnecessary fields', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
            interests
            ...User
            about
          }

          otherUser {
            id
            name
          }
        }

        fragment User on User {
          tags {
            primary { name }
            secondary { name }
          }
        }
      `

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          interests: 'Hi',
        },
        user: {
          id: '10',
        },
      }

      const newQuery = print(passThroughQuery(cache, query, null, normalizeEntities))

      expect(newQuery).to.equal(print(gql`
        query {
          user {
            id
            dateOfBirth
            ...User
            about
          }
          otherUser {
            id
            name
          }
        }

        fragment User on User {
          tags {
            primary { name }
            secondary { name }
          }
        }
      `))
    })

    it('should take a complex cache state with normalized entities and query and remove unnecessary fields', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth

            friends(first: 3) {
              user {
                id
                name
              }
            }

            nestedUser {
              id
              about
              foo
            }
          }

          someOtherUser {
            id
            interests
          }
        }
      `

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          interests: 'What?!',
          foo: 'bar',
          [cacheKey('friends', { first: 3 })]: [
            { user: { id: '11' } },
            { user: { id: '12' } },
          ],
          nestedUser: {
            id: '10',
          },
        },
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 1',
        },
        [cacheKey('node', { id: '12' })]: {
          id: '12',
          // name is missing!!
        },
        user: {
          id: '10',
        },
        someOtherUser: {
          id: '10',
        },
      }

      const newQuery = print(passThroughQuery(cache, query, null, normalizeEntities))

      expect(newQuery).to.equal(print(gql`
        query {
          user {
            id

            friends(first: 3) {
              user {
                id
                name
              }
            }

            nestedUser {
              id
              about
            }
          }
        }
      `))
    })
  })

  describe('queryCache', function () {
    it('should take a simple cache state and query and return the correct data', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
          }
        }
      `

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
        user: {
          id: '10',
        },
      }
      const results = queryCache(cache, query, null, normalizeEntities)

      expect(results).to.eql({
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
      })
    })

    it('should take a complex cache state and query and return the correct data', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth

            friends(first: 3) {
              user {
                id
                name
              }
            }

            nestedUser {
              id
              about
            }
          }

          someOtherUser {
            id
            interests
          }
        }
      `

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          interests: 'What?!',
          about: 'Same user inside itself.',
          [cacheKey('friends', { first: 3 })]: [
            { user: { id: '11' } },
            { user: { id: '12' } },
          ],
          nestedUser: {
            id: '10',
          },
        },
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 1',
        },
        [cacheKey('node', { id: '12' })]: {
          id: '12',
          name: 'Person 2',
        },
        user: {
          id: '10',
        },
        someOtherUser: {
          id: '10',
        },
      }

      const results = queryCache(cache, query, null, normalizeEntities)

      expect(results).to.eql({
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          friends: [
            {
              user: {
                id: '11',
                name: 'Person 1',
              },
            },
            {
              user: {
                id: '12',
                name: 'Person 2',
              },
            },
          ],
          nestedUser: {
            id: '10',
            about: 'Same user inside itself.',
          },
        },
        someOtherUser: {
          id: '10',
          interests: 'What?!',
        },
      })
    })
  })

})