/**
 * GraphQL ApolloServer wrapper.
 *
 * @author Joshua Gray {@link https://github.com/jmg1138}
 * @copyright Copyright (C) 2017-2022
 * @license GNU AGPLv3 or later
 *
 * This file is part of Recipe.Report API server.
 * @see {@link https://github.com/unblinking/recipe-report}
 *
 * Recipe.Report API Server is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Recipe.Report API Server is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * @module
 */
import type { ExpressContext } from 'apollo-server-express'
import { ApolloServer } from 'apollo-server-express'

import { typeDefs } from './schema'

const resolvers = {
  Query: {
    hello: (): string => 'Hello world!',
  },
}

export const apolloServer: ApolloServer<ExpressContext> = new ApolloServer({
  typeDefs: typeDefs,
  resolvers: resolvers,
})
