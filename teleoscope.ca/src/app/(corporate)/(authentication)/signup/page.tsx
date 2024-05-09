import { Metadata } from "next"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { UserAuthForm } from "@/components/Authentication"
import { mdb } from "@/lib/db"
import { Argon2id } from "oslo/password"
import { authenticate } from "@/lib/auth"
import { redirect } from "next/navigation"
import { generateIdFromEntropySize } from "lucia"
import { validateEmail, validatePassword, ActionResult, errors } from "@/lib/validate"
import { MongoError } from 'mongodb'
import { ensure } from "@/lib/db"

export const metadata: Metadata = {
  title: "Authentication",
  description: "Authentication forms built using the components.",
}

export default function AuthenticationPage() {
  
  return (
    <>
      <div className="container relative hidden h-[800px] flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <Link
          href="/signin"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "absolute right-4 top-4 md:right-8 md:top-8"
          )}
        >
          Login
        </Link>
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
          <div className="absolute inset-0 bg-zinc-900" />
          <div className="relative z-20 flex items-center text-lg font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2 h-6 w-6"
            >
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
            </svg>
            Teleoscope Research Inc
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">
                &ldquo;This library has saved me countless hours of work and
                helped me deliver stunning designs to my clients faster than
                ever before.&rdquo;
              </p>
              <footer className="text-sm">Sofia Davis</footer>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Create an account
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email below to create your account
              </p>
            </div>
            <UserAuthForm onLogin={signup} buttonText="Sign Up with Email" />
            <p className="px-8 text-center text-sm text-muted-foreground">
              By clicking continue, you agree to our{" "}
              <Link
                href="/terms"
                className="underline underline-offset-4 hover:text-primary"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-4 hover:text-primary"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

async function signup(formData: FormData): Promise<ActionResult> {
	"use server";
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

  // Ensure db collections exist with current validation rules
  // only run in dev or debug, otherwise the dbs should exist
  if (process.env.NODE_ENV === 'development') {
    // Code to run in development mode
    ensure()
  }
  
  
	const hashedPassword = await new Argon2id().hash(password.toString());
	const userId = generateIdFromEntropySize(10); // 16 characters long

  try {
    const db = await mdb()
    // Attempt to insert a new user
    
    const user_result = await db.collection("users").insertOne({
      // @ts-ignore
      _id: userId,
      emails: [email],
      hashed_password: hashedPassword
    });
  
    await db.collection("accounts").insertOne({
      users: {
        owner: user_result.insertedId
      }
    });
    
    await authenticate(userId);
    
  } catch (error) {
    try { 
      const mongoError = error as MongoError;
      if (mongoError.code === 11000) {
        return errors.exists;
      }
    } catch (e) {
      throw e  
    }
    throw error
  }
	return redirect("/dashboard");
}