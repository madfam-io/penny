import NextAuth from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import { prisma } from '@penny/database';
import { compare } from 'bcryptjs';
import { generateId } from '@penny/shared';

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Find user in database
          const user = await prisma.user.findFirst({
            where: {
              email: credentials.email,
              isActive: true,
            },
            include: {
              roles: {
                include: {
                  role: true,
                },
              },
            },
          });

          if (!user || !user.passwordHash) {
            return null;
          }

          // Verify password
          const isPasswordValid = await compare(credentials.password, user.passwordHash);
          if (!isPasswordValid) {
            return null;
          }

          // Update last login
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          // Return user data for JWT
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatar,
            tenantId: user.tenantId,
            roles: user.roles.map(ur => ur.role.name),
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle OAuth sign-in
      if (account?.provider !== 'credentials') {
        try {
          // Check if user exists
          let dbUser = await prisma.user.findFirst({
            where: { email: user.email! },
          });

          if (!dbUser) {
            // Create new user from OAuth
            const defaultTenant = await prisma.tenant.findFirst({
              where: { slug: 'default' },
            });

            if (!defaultTenant) {
              return false;
            }

            dbUser = await prisma.user.create({
              data: {
                id: generateId('usr'),
                email: user.email!,
                name: user.name || 'User',
                avatar: user.image,
                tenantId: defaultTenant.id,
                emailVerified: new Date(),
                isActive: true,
              },
            });

            // Assign default role
            const viewerRole = await prisma.role.findFirst({
              where: { name: 'viewer' },
            });

            if (viewerRole) {
              await prisma.userRole.create({
                data: {
                  userId: dbUser.id,
                  roleId: viewerRole.id,
                },
              });
            }
          }

          // Update last login
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { lastLoginAt: new Date() },
          });
        } catch (error) {
          console.error('OAuth sign-in error:', error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as any).tenantId;
        token.roles = (user as any).roles || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).roles = token.roles;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after sign-in
      if (url === baseUrl) {
        return `${baseUrl}/dashboard`;
      }
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },
  events: {
    async signIn({ user }) {
      // Log sign-in event
      await prisma.auditLog.create({
        data: {
          tenantId: (user as any).tenantId,
          userId: user.id!,
          action: 'auth.signin',
          resource: 'session',
          metadata: {
            timestamp: new Date().toISOString(),
          },
        },
      });
    },
    async signOut({ token }) {
      // Log sign-out event
      if (token?.id) {
        await prisma.auditLog.create({
          data: {
            tenantId: token.tenantId as string,
            userId: token.id as string,
            action: 'auth.signout',
            resource: 'session',
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };