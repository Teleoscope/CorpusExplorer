import { authOptions } from 'pages/api/auth/[...nextauth]';
import { getServerSession } from "next-auth/next";
import getToken from "next-auth/next";
import getSession from "next-auth/next";

export default async function handler(req, res) {
  const session1 = await getServerSession(req, res, authOptions)
  const session2 = await getToken({ req: req, secret: process.env.NEXTAUTH_SECRET });
  const session = await getSession({req: req, authOptions: authOptions})

  console.log(session1, session2, session)

  if (!session) {
    res.status(401).json({ message: "You must be logged in.", session: session });
    return;
  }

  return res.json({
    message: 'Success',
    session: session
  })
}