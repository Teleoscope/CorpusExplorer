import clientPromise from "@/util/mongodb";

export default async (req, res) => {
  const client = await clientPromise;
  const db = await client.db(req.query.db);
  const users = await db.collection("registeredUsers").find({}).toArray();
  res.json(users);
};
