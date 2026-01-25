import { getServerSession } from "next-auth"
import { authOptions } from "./options";

export interface Session {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
    defaultWorkspace?: string;
  };
}

export const getSession = async () => {
    return getServerSession(authOptions) as Promise<Session>;
}