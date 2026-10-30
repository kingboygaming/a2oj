import { redirect } from "next/navigation";
import { ProfileSettings } from "@/components/ProfileSettings";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PersonalSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { bio: true, school: true, avatarMimeType: true },
  });

  return (
    <ProfileSettings
      username={user.username}
      displayName={user.displayName}
      bio={profile.bio}
      school={profile.school}
      avatarUrl={`/api/users/${encodeURIComponent(user.username)}/avatar`}
      hasAvatar={Boolean(profile.avatarMimeType)}
    />
  );
}
