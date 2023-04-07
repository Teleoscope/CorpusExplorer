import clientPromise from '@/util/mongodb';
import { ObjectId } from 'bson';

export default async (req, res) => {
  const client = await clientPromise;
  const db = await client.db(req.query.db);
  const { teleoscopes } = req.query;
  const teleoscope = await db.collection("teleoscopes").findOne({_id: new ObjectId(teleoscopes)});
  res.json(teleoscope);
};
