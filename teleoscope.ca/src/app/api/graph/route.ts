import { validateRequest } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { dbOp } from '@/lib/db';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { Graph } from '@/types/graph';

export async function GET(request: NextRequest) {
    const { user, session } = await validateRequest();
    if (!user) {
        return NextResponse.json({ message: 'No user signed in.' });
    }
    try {
        const uid = request.nextUrl.searchParams.get('uid');
        const uids = request.nextUrl.searchParams.get('uids')?.split(",");
        const oid = request.nextUrl.searchParams.get('oid');

        if (uid && !uids) {
            const result = await dbOp(async (client: MongoClient, db: Db) => {
                return await db
                    .collection<Graph>('graph')
                    .findOne({uid: uid})
            });
            return Response.json(result);
        } else if (uids && !uid) {
            const result = await dbOp(async (client: MongoClient, db: Db) => {
                return await db
                    .collection<Graph>('graph')
                    .find({uid: {$in: uids}}).toArray()
            });
            return Response.json(result);
        } else if (oid) {
            const result = await dbOp(async (client: MongoClient, db: Db) => {
            return await db
                .collection<Graph>("graph")
                .findOne({reference: new ObjectId(oid)})
            });
            return Response.json(result);
        }
        throw new Error("No OID, UID or list of UIDs provided.")
    } catch (error) {
        throw new Error(error, request)
    }    
}
