import { Reimb } from '../models/reimb';
import { CrudRepository } from './crud-repo';
import {
    InternalServerError
} from '../errors/errors';
import { PoolClient } from 'pg';
import { connectionPool } from '..';
import { mapReimbResultSet } from '../util/result-set-mapper';

export class ReimbRepository implements CrudRepository<Reimb> {

    baseQuery = `
    select
    rb.reimb_id, 
    rb.amount, 
    rb.submitted, 
    rb.resolved,
    rb.reciept,
    rb.description,
    eu.username as author,
    eu2.username as resolver,
    rs.reimb_status as reimb_status,
    rt.reimb_type as reimb_type

    from ers_reimbursements rb

     JOIN ers_reimb_types rt
    ON rb.reimb_type_id =rt.reimb_type_id

     JOIN ers_reimb_statuses rs
    ON rb.reimb_status_id = rs.reimb_status_id

    left JOIN ers_users eu
    ON rb.author_id = eu.ers_user_id
    
	left JOIN ers_users eu2
    ON
    rb.resolver_id = eu2.ers_user_id
    `;

    /**
     * Gets all reimbs, for testing
     * @returns all reimb[]
     */
    async getAll(): Promise<Reimb[]> {
        let client: PoolClient;
        try {
            client = await connectionPool.connect();
            let sql = `${this.baseQuery}`;
            let rs = await client.query(sql);
            return rs.rows.map(mapReimbResultSet);
        } catch (e) {
            throw new InternalServerError();
        } finally {
            client && client.release();
        }
    }


    /**
     * Gets by id
     * @param id 
     * @returns by id 
     */
    async getById(id: number): Promise<Reimb> {
        let client: PoolClient;
        try {
            client = await connectionPool.connect();
            let sql = `${this.baseQuery} where reimb_id = $1`;
            let rs = await client.query(sql, [id]);
            return mapReimbResultSet(rs.rows[0]);
        } catch (e) {
            throw new InternalServerError();
        } finally {
            client && client.release();
        }
    }

    async getByUserId(id: number): Promise<Reimb[]> {
        let client: PoolClient;
        try {
            client = await connectionPool.connect();
            let sql = `${this.baseQuery} where author_id = $1`;
            let rs = await client.query(sql, [id]);
            return rs.rows.map(mapReimbResultSet);
        } catch (e) {
            throw new InternalServerError();
        } finally {
            client && client.release();
        }
    }
    /**
     * Gets reimb by unique key
     * @param key 
     * @param val 
     * @returns reimb by unique key 
     */
    async getReimbByUniqueKey(key: string, val: any): Promise<Reimb> {
        let client: PoolClient;
        try {
            client = await connectionPool.connect();
            let sql = `${this.baseQuery} where rb.${key} = $1`;
            let rs = await client.query(sql, [val]);
            return mapReimbResultSet(rs.rows[0]);
        } catch (e) {
            throw new InternalServerError();
        } finally {
            client && client.release();
        }
    }

    async getReimbByFilter(status: any, type: any): Promise<Reimb[]> {
        let client: PoolClient;
        try {
            client = await connectionPool.connect();
            if (status && type) {

                let sql = `${this.baseQuery} where reimb_status = $1 and reimb_type = $2`;
                let rs = await client.query(sql, [status, type]);
                return rs.rows.map(mapReimbResultSet);
            } else if (status) {

                let sql = `${this.baseQuery} where reimb_status = $1`;
                let rs = await client.query(sql, [status]);

                return rs.rows.map(mapReimbResultSet);
            } else if (type) {
                let sql = `${this.baseQuery} where reimb_type = $1`;
                let rs = await client.query(sql, [type]);
                return rs.rows.map(mapReimbResultSet);
            }


        } catch (e) {
            throw new InternalServerError();
        } finally {
            client && client.release();
        }
    }

    /**
     * Saves reimb repository
     * @param newReimb 
     * @returns save 
     */
    async save(newReimb: Reimb): Promise<Reimb> {
        let client: PoolClient;
        try {
            client = await connectionPool.connect();
            let reimb_type_id = (await client.query('select reimb_type_id from ers_reimb_types where reimb_type = $1', [newReimb.reimb_type])).rows[0].reimb_type_id;
            let author_id = (await client.query('select ers_user_id from ers_users where username = $1', [newReimb.author])).rows[0].ers_user_id;

            let sql = `
                insert into ers_reimbursements (amount, submitted, resolved, description, reciept, author_id, resolver_id, reimb_status_id, reimb_type_id) 
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning reimb_id
            `;
            let rs = await client.query(sql,
                [
                    newReimb.amount,
                    newReimb.submitted,
                    // no resolved date
                    null,
                    newReimb.description,
                    //no reciept for new
                    null,
                    author_id,
                    //no resolver
                    null,
                    //new reimb always pending
                    1,
                    reimb_type_id]);

            newReimb.reimb_id = rs.rows[0];

            return newReimb;

        } catch (e) {
            throw new InternalServerError();
        } finally {
            client && client.release();
        }

    }

    /**
     * Updates reimb repository
     * @param updatedReimb 
     * @returns boolean 
     */
    async update(updatedReimb: Reimb): Promise<boolean> {
        let client: PoolClient;
        try {
            client = await connectionPool.connect();
            let reimb_type_id = (await client.query('select reimb_type_id from ers_reimb_types where reimb_type = $1', [updatedReimb.reimb_type])).rows[0].reimb_type_id;
            let reimb_status_id = (await client.query('select reimb_status_id from ers_reimb_statuses where reimb_status = $1', [updatedReimb.reimb_status])).rows[0].reimb_status_id;
            let resolver_id;
            if (updatedReimb.resolver) {
                resolver_id = (await client.query('select ers_user_id from ers_users where username = $1', [updatedReimb.resolver])).rows[0].ers_user_id;
            } else {
                resolver_id = null;
            }
            let author_id = (await client.query('select ers_user_id from ers_users where username = $1', [updatedReimb.author])).rows[0].ers_user_id;
            let sql = `update ers_reimbursements set amount = $1, submitted = $2, resolved = $3, description = $4, reciept = $5, author_id = $6, resolver_id = $7, reimb_type_id = $8, reimb_status_id = $9 where reimb_id = $10`;
            let rs = await client.query(sql,
                [
                    updatedReimb.amount,
                    updatedReimb.submitted,
                    updatedReimb.resolved,
                    updatedReimb.description,
                    updatedReimb.reciept,
                    author_id,
                    resolver_id,
                    reimb_type_id ,
                    reimb_status_id,
                    updatedReimb.reimb_id
                ]);
            return true;
        } catch (e) {
            throw new InternalServerError();
        } finally {
            client && client.release();
        }

    }

    /**
     * Deletes by id
     * @param id  
     * @returns by id 
     */
    async deleteById(id: number): Promise<boolean> {
        let client: PoolClient;
        try {
            client = await connectionPool.connect();
            let sql = `delete from ers_reimbs where reimb_id = $1`;
            let rs = await client.query(sql, [id]);
            return true;
        } catch (e) {
            throw new InternalServerError();
        } finally {
            client && client.release();
        }

    }

}
