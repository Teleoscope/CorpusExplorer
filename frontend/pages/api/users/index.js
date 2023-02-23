import clientPromise from '../../../util/mongodb';

export default async (req, res) => {
  const client = await clientPromise;
  const db = await client.db('teleoscope');
  const users = await db.collection("users").find({}).toArray();
  res.json(users);
};
