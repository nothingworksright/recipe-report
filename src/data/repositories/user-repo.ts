/**
 * User repository.
 *
 * @author Joshua Gray {@link https://github.com/jmg1138}
 * @copyright Copyright (C) 2017-2021
 * @license GNU AGPLv3 or later
 *
 * This file is part of Recipe.Report API server.
 * @see {@link https://github.com/nothingworksright/api.recipe.report}
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
import { PoolClient, QueryResult } from 'pg'

import { IUser, User } from 'domain/models/user'
import { UniqueId } from 'domain/value-objects/uid'

import { dbTables, errBase, errMsg } from 'data/constants'
import { BaseRepo, IBaseRepo } from 'data/repositories/base-repo'

import { Err } from 'root/utils'

export interface IUserRepo extends IBaseRepo {
  create(user: IUser): Promise<User>
  authenticate(user: IUser): Promise<User>
}

export class UserRepo extends BaseRepo<User> implements IUserRepo {
  constructor(client: PoolClient) {
    super(client, dbTables.USERS)
  }

  public create = async (user: IUser): Promise<User> => {
    // Verify no existing user by username or email address.
    const countName = await this._countByColumn('name', user.name.toString())
    if (countName > 0) {
      throw new Err(`REG_USRNAME_USED`, errMsg.REG_USRNAME_USED)
    }
    const countEmail = await this._countByColumn(
      'email_address',
      user.email_address.toString(),
    )
    if (countEmail > 0) {
      throw new Err(`REG_EMAIL_USED`, errMsg.REG_EMAIL_USED)
    }

    // Save the user into the database.
    const query = `SELECT * FROM rr.users_create($1, $2, $3, $4)`
    const result: QueryResult = await this.client.query(query, [
      user.name,
      user.password,
      user.email_address,
      user.role,
    ])

    // Return domain object from database query results.
    return User.create(result.rows[0], result.rows[0].id)
  }

  public authenticate = async (user: IUser): Promise<User> => {
    const query = `SELECT id FROM users WHERE email_address = $1 AND password = crypt($2, password)`
    // Use this.pool.query, so that this query isn't logged like other queries.
    const result: QueryResult = await this.client.query(query, [
      user.email_address,
      user.password,
    ])
    if (result.rowCount !== 1) {
      throw new Err(`AUTH`, errBase.AUTH)
    }
    // Update the authenticated user's last login date in the database.
    await this._lastLogin(result.rows[0].id)

    // Return domain object from database query results.
    return User.create(result.rows[0], result.rows[0].id)
  }

  //#region Private methods

  private _countByColumn = async (
    column: string,
    value: string,
  ): Promise<number> => {
    const query = `SELECT $1 FROM ${dbTables.USERS} WHERE $1 = $2`
    const result = await this.client.query(query, [column, value])
    const count = result.rowCount
    return count
  }

  private _lastLogin = async (id: UniqueId): Promise<void> => {
    const query: string = `UPDATE ${dbTables.USERS} SET $1 = $2 WHERE $3 = $4`
    await this.client.query(query, [
      `date_last_login`,
      Date.toString(),
      `id`,
      id.toString(),
    ])
  }

  //#endregion
}
