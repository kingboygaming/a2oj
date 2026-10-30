import { redirect } from "next/navigation";
import { EmailSettings } from "@/components/EmailSettings";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EmailSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, emailVerifiedAt: true, pendingEmail: true },
  });

  return (
    <EmailSettings
      email={account.email}
      emailVerified={Boolean(account.emailVerifiedAt)}
      pendingEmail={account.pendingEmail}
    />
  );
}
