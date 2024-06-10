"use server";

import { MongodbAdapter } from "@lucia-auth/adapter-mongodb";
import { Collection } from "mongodb";
import { Lucia, RegisteredDatabaseUserAttributes, Session, User } from "lucia";
import { client } from "@/lib/db";
import { cookies } from "next/headers";
import { verify } from "@node-rs/argon2";
import { cache } from "react";
import { Argon2id } from "oslo/password";
import { redirect } from "next/navigation";
import { generateIdFromEntropySize } from "lucia";
import {
  validateEmail,
  validatePassword,
  emailExists,
  ActionResult,
  errors,
} from "@/lib/validate";
import initialize_user from "@/lib/account";
import { resolve_subscriptions_by_user_id } from "./stripe";

interface UserDoc extends RegisteredDatabaseUserAttributes {
  _id: string;
}

interface SessionDoc {
  _id: string;
  expires_at: Date;
  user_id: string;
}

async function getUsersAndSessionsCollections() {
  const db = (await client()).db();
  const SessionCollection = db.collection("sessions") as Collection<SessionDoc>;
  const UserCollection = db.collection("users") as Collection<UserDoc>;
  return { Session: SessionCollection, User: UserCollection };
}

async function connect(): Promise<
  Lucia<Record<never, never>, Record<never, never>>
> {
  const { Session, User } = await getUsersAndSessionsCollections();
  const adapter = new MongodbAdapter(Session, User);

  const lucia = new Lucia(adapter, {
    sessionCookie: {
      expires: false,
      attributes: {
        secure: process.env.NODE_ENV === "production",
      },
    },
  });
  return lucia;
}

export async function signout() {
  const lucia = await connect();
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? "";

  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );

  await lucia.invalidateSession(sessionId);

  return redirect("/signin");
}

export const validateRequest = cache(
  async (): Promise<
    { user: User; session: Session } | { user: null; session: null }
  > => {
    const lucia = await connect();
    const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? null;
    if (!sessionId) {
      return {
        user: null,
        session: null,
      };
    }

    const result = await lucia.validateSession(sessionId);

    // next.js throws when you attempt to set cookie when rendering page
    try {
      if (result.session && result.session.fresh) {
        const sessionCookie = lucia.createSessionCookie(result.session.id);
        cookies().set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes
        );
      }
      if (!result.session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        cookies().set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes
        );
      }
    } catch {}
    return result;
  }
);

// Authenticate
export async function authenticate(userId: string): Promise<Session> {
  const lucia = await connect();
  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );
  return session;
}

export async function signin(formData: FormData): Promise<ActionResult> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!password || !email) {
    return errors.missing;
  }
  if (!validateEmail(email)) {
    return errors.email;
  }
  if (!validatePassword(password)) {
    return errors.password;
  }

  const db = (await client()).db();
  const existingUser = await db
    .collection("users")
    .findOne({ emails: [email] });
  if (!existingUser) {
    // NOTE:
    // Returning immediately allows malicious actors to figure out valid usernames from response times,
    // allowing them to only focus on guessing passwords in brute-force attacks.
    // As a preventive measure, you may want to hash passwords even for invalid usernames.
    // However, valid usernames can be already be revealed with the signup page among other methods.
    // It will also be much more resource intensive.
    // Since protecting against this is non-trivial,
    // it is crucial your implementation is protected against brute-force attacks with login throttling etc.
    // If usernames are public, you may outright tell the user that the username is invalid.
    return errors.incorrect;
  }

  const validPassword = await verify(
    existingUser.hashed_password,
    password.toString(),
    {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    }
  );

  if (!validPassword) {
    return errors.incorrect;
  }

  // @ts-ignore
  const session = await authenticate(existingUser._id);
  
  // reconcile accounts
  const accounts = await resolve_subscriptions_by_user_id(existingUser._id.toString())

  return redirect("/dashboard");
}

export async function signup(formData: FormData): Promise<ActionResult> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!password || !email) {
    return errors.missing;
  }
  if (!validateEmail(email)) {
    return errors.email;
  }
  if (!validatePassword(password)) {
    return errors.password;
  }

  const exists = await emailExists(email);
  if (exists) {
    return errors.exists;
  }

  const hashedPassword = await new Argon2id().hash(password.toString());
  const userId = generateIdFromEntropySize(10); // 16 characters long

  await initialize_user(userId, hashedPassword, email);
  await authenticate(userId);

  return redirect("/dashboard");
}
