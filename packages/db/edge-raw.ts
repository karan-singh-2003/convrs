import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL!;

// Initialize neon client for edge runtime
const sql = neon(connectionString, {
  fetchOptions: {
    cache: "no-store",
  },
});

export { sql };

// Helper functions for common queries used in middleware
export const edgeDb = {
  async findUser(id: string) {
    try {
      const result = await sql`
        SELECT * FROM "User" WHERE id = ${id}
      `;
      return result[0] || null;
    } catch (error) {
      console.error("Error in findUser:", error);
      return null;
    }
  },

  async findUserWithWorkspaces(id: string) {
    try {
      const result = await sql`
        SELECT 
          u.*,
          json_agg(
            json_build_object(
              'workspace', json_build_object('slug', w.slug)
            )
          ) FILTER (WHERE wu."userId" IS NOT NULL) as "workspaceUsers"
        FROM "User" u
        LEFT JOIN "WorkspaceUsers" wu ON wu."userId" = u.id
        LEFT JOIN "Workspace" w ON w.id = wu."workspaceId"
        WHERE u.id = ${id}
        GROUP BY u.id
      `;
      return result[0] || null;
    } catch (error) {
      console.error("Error in findUserWithWorkspaces:", error);
      return null;
    }
  },

  async countPendingInvites(email: string) {
    try {
      const result = await sql`
        SELECT COUNT(*) as count
        FROM "WorkspaceInvite"
        WHERE email = ${email}
        AND expires >= NOW()
      `;
      return parseInt(result[0]?.count || "0");
    } catch (error) {
      console.error("Error in countPendingInvites:", error);
      return 0;
    }
  },
};
