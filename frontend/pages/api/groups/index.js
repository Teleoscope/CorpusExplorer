import clientPromise from '../../../util/mongodb';

export default async (req, res) => {
  const client = await clientPromise;
  const db = await client.db('teleoscope');
  const groups = await db.collection("groups").find({}).toArray();
  res.json(groups);
};
