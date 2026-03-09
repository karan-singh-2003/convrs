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
import { decode, encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { TWO_FA_COOKIE_NAME } from "./constants";
import { getTOTPInstance } from "./totp";
import PasskeyProvider from "@teamhanko/passkeys-next-auth-provider";
import hanko from "../hanko";
import {
  createTrackedSession,
  getClientIp,
  touchSession,
} from "./session-tracking";
import { redisWithTimeout } from "../upstash";
import { isSamlEnforcedForEmailDomain } from "../workspaces/is-saml-enforced-for-email-domain";
import { isStored } from "../storage";
import { storage } from "../storage";
import { nanoid } from "@repo/utils";
import sendMagicLinkEmail  from "@repo/email/templates/send-magic-link";

const VERCEL_DEPLOYMENT = !!process.env.VERCEL_ENV;

const setTwoFactorAuthCookie = async (user: Pick<User, "id" | "email">) => {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET as string,
    maxAge: 2 * 60,
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      purpose: "2fa",
      iat: Math.floor(Date.now() / 1000),
    },
  });

  (await cookies()).set({
    name: TWO_FA_COOKIE_NAME,
    value: token,
    path: "/",
    httpOnly: true,
    secure: VERCEL_DEPLOYMENT,
    expires: new Date(Date.now() + 2 * 60 * 1000),
    sameSite: "lax",
  });
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as any),
  providers: [
    PasskeyProvider({
      tenant: hanko,
      async authorize({ userId }) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return null;
        return user;
      },
    }),
    EmailProvider({
      async sendVerificationRequest({ identifier, url }) {
        const subject = `Your ${process.env.NEXT_PUBLIC_APP_NAME} Login Link`;

        await sendEmail({
          to: identifier,
          subject,
          react: sendMagicLinkEmail({
            email: identifier,
            url,
          }),
        });
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

        // user is authorized but doesn't have a Boilercode account, create one for them
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
            twoFactorConfirmedAt: true,
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

        if (user.twoFactorConfirmedAt) {
          await setTwoFactorAuthCookie(user);
          throw new Error("2FA token required.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    // Two factor
    CredentialsProvider({
      id: "two-factor-challenge",
      name: "Two-factor challenge",
      type: "credentials",
      credentials: {
        code: { type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials) {
          throw new Error("no-credentials");
        }

        const { code } = credentials;

        if (!code) {
          throw new Error("no-credentials");
        }

        const cookie = (await cookies()).get(TWO_FA_COOKIE_NAME);

        if (!cookie) {
          throw new Error("no-2fa-token");
        }

        const decoded = await decode({
          token: cookie.value,
          secret: process.env.NEXTAUTH_SECRET as string,
        });

        if (!decoded) {
          throw new Error("invalid-2fa-token");
        }

        (await cookies()).delete(TWO_FA_COOKIE_NAME);

        const { sub, email } = decoded;

        const user = await prisma.user.findUnique({
          where: {
            id: sub,
            email: email as string,
          },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            twoFactorConfirmedAt: true,
            twoFactorSecret: true,
          },
        });

        if (!user) {
          console.error("User not found", { sub, email });
          throw new Error("invalid-credentials");
        }

        if (!user.twoFactorConfirmedAt) {
          console.error("Two-factor not confirmed", { sub, email });
          throw new Error("invalid-credentials");
        }

        if (!user.twoFactorSecret) {
          console.error("Two-factor secret not found", { sub, email });
          throw new Error("invalid-credentials");
        }

        const totp = getTOTPInstance({
          secret: user.twoFactorSecret,
        });

        const delta = totp.validate({
          token: code,
          window: 1,
        });

        if (delta === null) {
          console.error("Invalid 2FA code entered", { sub, email });
          throw new Error("invalid-2fa-code");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
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

      if (
        account?.provider !== "saml" &&
        account?.provider !== "saml-idp" &&
        account?.provider !== "credentials"
      ) {
        const ssoEnforced = await isSamlEnforcedForEmailDomain(user.email);
        if (ssoEnforced) {
          throw new Error(`require-saml-sso`);
        }
      }

      if (account?.provider === "google" || account?.provider === "github") {
        const userExists = await prisma.user.findUnique({
          where: { email: user.email },
          select: {
            id: true,
            name: true,
            image: true,
            twoFactorConfirmedAt: true,
          },
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
          if ((!userExists.image || isStored(userExists.image)) && profilePic) {
            const { url } = await storage.upload({
              key: `avatars/${userExists.id}_${nanoid(7)}`,
              body: profilePic,
            });
            newAvatar = url;
          }

          await prisma.user.update({
            where: { email: user.email },
            data: {
              // @ts-ignore - profile.login exists on GitHub profile
              ...(!userExists.name && { name: profile.name || profile.login }),
              ...(newAvatar && { image: newAvatar }),
            },
          });
        }

        // If the user has 2FA enabled, abort the OAuth sign-in and require
        // them to verify their TOTP code before a session is created.
        if (userExists.twoFactorConfirmedAt) {
          await setTwoFactorAuthCookie({
            id: userExists.id,
            email: user.email!,
          });
          throw new Error("two-factor-required");
        }
      } else if (
        account?.provider === "saml" ||
        account?.provider === "saml-idp"
      ) {
        let samlProfile;

        if (account?.provider === "saml-idp") {
          // @ts-ignore
          samlProfile = user.profile;
          if (!samlProfile) {
            return true;
          }
        } else {
          samlProfile = profile;
        }

        if (!samlProfile?.requested?.tenant) {
          return false;
        }

        const workspace = await prisma.workspace.findUnique({
          where: {
            id: samlProfile.requested.tenant,
          },
          select: {
            id: true,
            ssoEmailDomain: true,
          },
        });
        console.log("SAML sign-in attempt for workspace", {
          workspaceId: samlProfile.requested.tenant,
          email: user.email,
        });
        console.log("Workspace details", { workspace });
        if (workspace) {
          const { ssoEmailDomain } = workspace;
          const emailDomain = user.email.split("@")[1];

          // ssoEmailDomain should be required for all SAML enabled workspace
          // this should not happen
          if (!ssoEmailDomain) {
            return false;
          }

          if (
            emailDomain.toLocaleLowerCase() !==
            ssoEmailDomain.toLocaleLowerCase()
          ) {
            return false;
          }

          await Promise.allSettled([
            // add user to workspace
            prisma.workspaceUsers.upsert({
              where: {
                userId_workspaceId: {
                  userId: user.id,
                  workspaceId: workspace.id,
                },
              },
              update: {},
              create: {
                workspaceId: workspace.id,
                userId: user.id,
              },
            }),
            // delete any pending invites for this user
            prisma.workspaceInvite.delete({
              where: {
                email_workspaceId: {
                  email: user.email,
                  workspaceId: workspace.id,
                },
              },
            }),
          ]);
        }
      }
      return true;
    },
    jwt: async ({ token, user, trigger }) => {
      if (!token.sub) {
        return token;
      }

      // Immediately invalidate revoked sessions — check Redis blocklist.
      // This ensures API routes also return 401 for revoked JWTs.
      if (token.sessionToken) {
        try {
          const revoked = await redisWithTimeout.get(
            `revoked-session:${token.sessionToken}`
          );
          if (revoked) {
            // Strip the subject so getServerSession returns a session with no
            // valid user id, causing withSession to reject the request as 401.
            return { ...token, sub: undefined } as typeof token;
          }
        } catch {
          // Redis timeout — fail open
        }
      }

      if (user) {
        token.user = user;
      }

      // Create a tracked session on first sign-in
      if (user && token.sub && !token.sessionToken) {
        try {
          const ip = await getClientIp();
          // Get user-agent from headers (may not be available in all contexts)
          const { headers: headersFn } = await import("next/headers");
          const headersList = await headersFn();
          const userAgent = headersList.get("user-agent") || "Unknown";
          const sessionToken = await createTrackedSession(
            token.sub,
            userAgent,
            ip
          );
          token.sessionToken = sessionToken;
        } catch (error) {
          console.error("Failed to create tracked session:", error);
        }
      }

      // Periodically touch session to update lastActive
      if (token.sessionToken && trigger !== "signIn") {
        // Only touch every 5 minutes to avoid excessive DB writes
        const lastTouched = (token.lastTouched as number) || 0;
        const now = Date.now();
        if (now - lastTouched > 5 * 60 * 1000) {
          await touchSession(token.sessionToken as string);
          token.lastTouched = now;
        }
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
      // Expose the tracked session token so API routes can identify the current session
      (session as any).sessionToken = token.sessionToken;
      return session;
    },
  },
};
