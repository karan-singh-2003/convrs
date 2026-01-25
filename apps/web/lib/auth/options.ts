import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@repo/db";
import { sendEmail } from "@repo/email";
import { validatePassword } from "./password";
import { jackson } from "../jackson";

const VERCEL_DEPLOYMENT = !!process.env.VERCEL_ENV;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as any),
  providers: [
    EmailProvider({
      sendVerificationRequest({ identifier, url }) {
        if (process.env.NODE_ENV === "development") {
          console.log(`Login link for ${identifier}: ${url}`);
          return;
        } else {
          sendEmail({
            to: identifier,
            subject: `Your ${process.env.NEXT_PUBLIC_APP_NAME} Login Link`,
            text: `Click here to login: ${url}`,
          });
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    {
      id: "saml",
      name: "BoxyHQ",
      type: "oauth",
      version: "2.0",
      checks: ["pkce", "state"],
      authorization: {
        url: `${process.env.NEXTAUTH_URL}/api/auth/saml/authorize`,
        params: {
          scope: "",
          response_type: "code",
          provider: "saml",
        },
      },
      token: {
        url: `${process.env.NEXTAUTH_URL}/api/auth/saml/token`,
        params: { grant_type: "authorization_code" },
      },
      userinfo: `${process.env.NEXTAUTH_URL}/api/auth/saml/userinfo`,
      profile: async (profile) => {
        let existingUser = await prisma.user.findUnique({
          where: { email: profile.email },
        });

        // user is authorized but doesn't have a Dub account, create one for them
        if (!existingUser) {
          existingUser = await prisma.user.create({
            data: {
              email: profile.email,
              name: `${profile.firstName || ""} ${
                profile.lastName || ""
              }`.trim(),
            },
          });
        }

        const { id, name, email, image } = existingUser;

        return {
          id,
          name,
          email,
          image,
        };
      },
      options: {
        clientId: "dummy",
        clientSecret: process.env.NEXTAUTH_SECRET as string,
      },
      allowDangerousEmailAccountLinking: true,
    },
    CredentialsProvider({
      id: "saml-idp",
      name: "IdP Login",
      credentials: {
        code: {},
      },
      async authorize(credentials) {
        if (!credentials) {
          return null;
        }

        const { code } = credentials;

        if (!code) {
          return null;
        }

        const { oauthController } = await jackson();

        // Fetch access token
        const { access_token } = await oauthController.token({
          code,
          grant_type: "authorization_code",
          redirect_uri: process.env.NEXTAUTH_URL as string,
          client_id: "dummy",
          client_secret: process.env.NEXTAUTH_SECRET as string,
        });

        if (!access_token) {
          return null;
        }

        // Fetch user info
        const userInfo = await oauthController.userInfo(access_token);

        if (!userInfo) {
          return null;
        }

        let existingUser = await prisma.user.findUnique({
          where: { email: userInfo.email },
        });

        // user is authorized but doesn't have a Dub account, create one for them
        if (!existingUser) {
          existingUser = await prisma.user.create({
            data: {
              email: userInfo.email,
              name: `${userInfo.firstName || ""} ${
                userInfo.lastName || ""
              }`.trim(),
            },
          });
        }

        const { id, name, email, image } = existingUser;

        return {
          id,
          email,
          name,
          email_verified: true,
          image,
          // adding profile here so we can access it in signIn callback
          profile: userInfo,
        };
      },
    }),
    // Sign In With Email And Password
    CredentialsProvider({
      name: "Credentials",
      id: "credentials",
      type: "credentials",
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials) {
          return null;
        }

        const { email, password } = credentials;

        if (!email || !password) {
          throw new Error("Email and password are required.");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            name: true,
            image: true,
            emailVerified: true,
          },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password.");
        }

        const passwordMatch = await validatePassword(
          password,
          user.passwordHash
        );
        if (!passwordMatch) {
          throw new Error("Invalid email or password.");
        }

        if (!user.emailVerified) {
          throw new Error(
            "Email not verified. Please verify your email before logging in."
          );
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: `${VERCEL_DEPLOYMENT ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        // When working on localhost, the cookie domain must be omitted entirely (https://stackoverflow.com/a/1188145)
        domain: VERCEL_DEPLOYMENT
          ? `.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
          : undefined,
        secure: VERCEL_DEPLOYMENT,
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      if (!user.email) {
        return false;
      }

      if (account?.provider === "google" || account?.provider === "github") {
        const userExists = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, name: true, image: true },
        });

        if (!userExists || !profile) {
          return true;
        }

        // If the user already exists via email,
        // update the user with their name and image
        if (userExists && profile) {
          // @ts-ignore - profile has different shapes for different providers
          const profilePic =
            profile[account.provider === "google" ? "picture" : "avatar_url"];

          let newAvatar: string | null = null;

          await prisma.user.update({
            where: { email: user.email },
            data: {
              // @ts-ignore - profile.login exists on GitHub profile
              ...(!userExists.name && { name: profile.name || profile.login }),
              ...(profilePic && !userExists.image && { image: profilePic }),
            },
          });
        }
      }

      return true;
    },
    jwt: async ({ token, user, trigger }) => {
      if (!token.sub) {
        return token;
      }

      if (user) {
        token.user = user;
      }

      if (trigger === "update") {
        const refreshedUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true, name: true, email: true, image: true },
        });

        if (refreshedUser) {
          token.user = refreshedUser;
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      session.user = {
        id: token.sub,
        // @ts-ignore
        ...(token || session).user,
      };
      return session;
    },
  },
};
