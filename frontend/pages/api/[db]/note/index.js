import clientPromise from "@/util/mongodb";

export default async (req, res) => {
  const client = await clientPromise;
  const db = await client.db(req.query.db);
  const notes = await db.collection("notes").find({}).toArray();
  res.json(notes);
};
