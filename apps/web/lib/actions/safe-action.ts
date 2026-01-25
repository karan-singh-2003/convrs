import { createSafeActionClient } from "next-safe-action";
import { getSession } from "../auth";

export const actionClient = createSafeActionClient({
  handleServerError: async (e) => {
    console.error("Action error:", e.message);

    if (e instanceof Error) {
      return e.message;
    }

    return "An unexpected error occurred.";
  },
});

export const authUserActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();
  if (!session?.user.id) {
    throw new Error("Unauthorized: Login required.");
  }

  return next({
    ctx: {
      user: session.user,
    },
  });
});
