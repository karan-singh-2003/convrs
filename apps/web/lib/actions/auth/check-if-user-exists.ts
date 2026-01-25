import { prisma } from "@repo/db";
export async function checkIfUserExists(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });
    return user !== null;
}