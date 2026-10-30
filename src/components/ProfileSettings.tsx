"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Props = {
  username: string;
  displayName: string;
  bio: string;
  school: string;
  avatarUrl: string;
  hasAvatar: boolean;
};

export function ProfileSettings({
  username,
  displayName: initialDisplayName,
  bio: initialBio,
  school: initialSchool,
  avatarUrl,
  hasAvatar,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [school, setSchool] = useState(initialSchool);
  const [avatar, setAvatar] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profileStatus, setProfileStatus] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("profile");
    setError("");
    setProfileStatus("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, school }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không lưu được hồ sơ.");
        return;
      }
      setProfileStatus("Đã cập nhật hồ sơ.");
      router.refresh();
    } catch {
      setError("Không thể kết nối để lưu hồ sơ.");
    } finally {
      setPendingAction("");
    }
  }

  async function uploadAvatar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!avatar) {
      setError("Hãy chọn ảnh đại diện trước.");
      return;
    }
    setPendingAction("avatar");
    setError("");
    setAvatarStatus("");
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": avatar.type },
        body: avatar,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không cập nhật được ảnh đại diện.");
        return;
      }
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      setAvatar(null);
      setAvatarStatus("Đã cập nhật ảnh đại diện.");
      router.refresh();
    } catch {
      setError("Không thể kết nối để tải ảnh lên.");
    } finally {
      setPendingAction("");
    }
  }

  async function removeAvatar() {
    setPendingAction("avatar");
    setError("");
    setAvatarStatus("");
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không xóa được ảnh đại diện.");
        return;
      }
      setAvatarStatus("Đã xóa ảnh đại diện.");
      router.refresh();
    } catch {
      setError("Không thể kết nối để xóa ảnh.");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
      <div>
        <h2 className="font-semibold text-[var(--navy)]">Thông tin cá nhân</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tiểu sử, trường học và ảnh đại diện sẽ hiển thị công khai trên hồ sơ.
        </p>
      </div>

      <form onSubmit={uploadAvatar} className="flex flex-wrap items-center gap-4">
        {hasAvatar ? (
          <Image
            src={avatarUrl}
            alt={`Ảnh đại diện của ${displayName}`}
            width={80}
            height={80}
            unoptimized
            className="size-20 rounded-full border border-[var(--line)] bg-white object-cover"
          />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-full bg-[var(--amber)] text-2xl font-semibold text-[var(--navy)]">
            {displayName.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
        <div className="min-w-60 flex-1">
          <p className="text-sm font-medium">Ảnh đại diện</p>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Chọn ảnh đại diện"
            onChange={(event) => {
              setAvatar(event.target.files?.[0] ?? null);
              setError("");
              setAvatarStatus("");
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={pendingAction !== ""}
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy)] hover:bg-[var(--navy)]/5 disabled:opacity-60"
            >
              {avatar ? "Chọn ảnh khác" : hasAvatar ? "Đổi ảnh đại diện" : "Chọn ảnh"}
            </button>
            {avatar && (
              <span className="max-w-56 truncate text-sm text-[var(--muted)]" title={avatar.name}>
                {avatar.name}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">JPEG, PNG hoặc WebP; tối đa 2 MB.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pendingAction !== "" || !avatar}
            className="rounded-md bg-[var(--surface-strong)] px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {pendingAction === "avatar" ? "Đang tải lên..." : "Cập nhật ảnh"}
          </button>
          <button
            type="button"
            disabled={pendingAction !== ""}
            onClick={removeAvatar}
            className="rounded-md border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-60"
          >
            Xóa ảnh
          </button>
        </div>
        {avatarStatus && (
          <p role="status" className="basis-full text-sm text-emerald-700">
            {avatarStatus}
          </p>
        )}
      </form>

      <form onSubmit={saveProfile} className="space-y-3 border-t border-[var(--line)] pt-4">
        <label className="block text-sm">
          Tên hiển thị
          <input
            required
            minLength={2}
            maxLength={60}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Trường học
          <input
            maxLength={120}
            value={school}
            onChange={(event) => setSchool(event.target.value)}
            placeholder="Tên trường"
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Tiểu sử
          <textarea
            maxLength={500}
            rows={4}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Giới thiệu ngắn về bạn"
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
          <span className="mt-1 block text-right text-xs text-[var(--muted)]">{bio.length}/500</span>
        </label>
        <button
          type="submit"
          disabled={pendingAction !== ""}
          className="rounded-md bg-[var(--surface-strong)] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {pendingAction === "profile" ? "Đang lưu..." : "Lưu hồ sơ"}
        </button>
        {profileStatus && <p role="status" className="text-sm text-emerald-700">{profileStatus}</p>}
      </form>

      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <a
        href={`/users/${encodeURIComponent(username)}`}
        className="inline-block text-sm font-medium text-[var(--teal)] hover:underline"
      >
        Xem hồ sơ công khai →
      </a>
    </section>
  );
}
