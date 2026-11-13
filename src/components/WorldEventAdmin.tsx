"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AdminEvent = {
  id: string;
  slug: string;
  eventType: "RESOURCE_RUSH" | "WORLD_BOSS";
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  participantLimit: number;
  participantCount: number;
  registeredCount: number;
  minFactoryLevel: number;
  contributionWoodCost: number;
  contributionCooldownSeconds: number;
  bossHp: number;
  bossHpRemaining: number;
  marchTravelSeconds: number;
  rewards: Array<{ wood: number; stone: number }>;
  status: string;
  job: { status: string; attempts: number; lastError: string | null } | null;
};

function localInputValue(iso: string) {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function localTimeLabel(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(status: string) {
  if (status === "SCHEDULED") return "Sắp diễn ra";
  if (status === "ACTIVE") return "Đang diễn ra";
  if (status === "COMPLETED") return "Đã tổng kết";
  if (status === "CANCELED") return "Đã hủy";
  if (status === "PROCESSING") return "Chờ tổng kết";
  if (status === "FAILED") return "Lỗi tác vụ";
  return status;
}

function NumberField({
  label,
  name,
  defaultValue,
  min = 0,
  max,
}: {
  label: string;
  name: string;
  defaultValue: number;
  min?: number;
  max: number;
}) {
  return (
    <label className="block text-xs text-[var(--muted)]">
      {label}
      <input
        required
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-2.5 py-2 text-sm text-[var(--ink)]"
      />
    </label>
  );
}

export function WorldEventAdmin({ initialEvents }: { initialEvents: AdminEvent[] }) {
  const router = useRouter();
  const [eventType, setEventType] = useState<AdminEvent["eventType"]>("RESOURCE_RUSH");
  const [busy, setBusy] = useState(false);
  const [busyEvent, setBusyEvent] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function submitEvent(formData: FormData) {
    const startsAt = String(formData.get("startsAt") ?? "");
    const endsAt = String(formData.get("endsAt") ?? "");
    const payload = {
      eventType: String(formData.get("eventType") ?? "RESOURCE_RUSH"),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      startsAt: startsAt ? new Date(startsAt).toISOString() : "",
      endsAt: endsAt ? new Date(endsAt).toISOString() : "",
      participantLimit: Number(formData.get("participantLimit")),
      minFactoryLevel: Number(formData.get("minFactoryLevel")),
      contributionWoodCost: Number(formData.get("contributionWoodCost")),
      contributionCooldownSeconds: Number(formData.get("contributionCooldownSeconds")),
      firstRewardWood: Number(formData.get("firstRewardWood")),
      firstRewardStone: Number(formData.get("firstRewardStone")),
      secondRewardWood: Number(formData.get("secondRewardWood")),
      secondRewardStone: Number(formData.get("secondRewardStone")),
      thirdRewardWood: Number(formData.get("thirdRewardWood")),
      thirdRewardStone: Number(formData.get("thirdRewardStone")),
      bossHp: Number(formData.get("bossHp") ?? 0),
      marchTravelSeconds: Number(formData.get("marchTravelSeconds") ?? 60),
    };

    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/admin/world/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không tạo được sự kiện.");
      setMessage(`Đã tạo sự kiện "${payload.title}".`);
      setEventType("RESOURCE_RUSH");
      (document.getElementById("world-event-form") as HTMLFormElement | null)?.reset();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Không thể tạo sự kiện.");
    } finally {
      setBusy(false);
    }
  }

  async function updateEvent(
    event: AdminEvent,
    action: "cancel" | "reschedule",
    form?: HTMLFormElement,
  ) {
    let payload: Record<string, string> = { action };
    if (action === "reschedule" && form) {
      const values = new FormData(form);
      const startsAt = String(values.get("startsAt") ?? "");
      const endsAt = String(values.get("endsAt") ?? "");
      payload = {
        action,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      };
    }

    setBusyEvent(event.id);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch(`/api/admin/world/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không cập nhật được sự kiện.");
      setMessage(action === "cancel" ? `Đã hủy "${event.title}".` : `Đã đổi lịch "${event.title}".`);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật sự kiện.");
    } finally {
      setBusyEvent("");
    }
  }

  return (
    <div className="mt-6 space-y-8">
      {message && (
        <p role={isError ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${isError ? "border-rose-400/40 bg-rose-400/10 text-rose-700" : "border-emerald-500/30 bg-emerald-500/10 text-[var(--navy)]"}`}>
          {message}
        </p>
      )}

      <form
        id="world-event-form"
        action={(formData) => void submitEvent(formData)}
        className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5"
      >
        <div>
          <h2 className="text-xl font-bold text-[var(--navy)]">Tạo sự kiện thế giới</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Thời gian hiển thị theo múi giờ máy của bạn; hệ thống lưu UTC.</p>
        </div>
        <label className="block text-sm text-[var(--navy)]">
          Loại sự kiện
          <select
            name="eventType"
            value={eventType}
            onChange={(event) => setEventType(event.target.value === "WORLD_BOSS" ? "WORLD_BOSS" : "RESOURCE_RUSH")}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)]"
          >
            <option value="RESOURCE_RUSH">Thu thập tài nguyên</option>
            <option value="WORLD_BOSS">Boss toàn server</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-[var(--navy)]">
            Tên sự kiện
            <input required minLength={3} maxLength={100} name="title" className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)]" />
          </label>
          <label className="block text-sm text-[var(--navy)]">
            Mô tả
            <input required minLength={3} maxLength={1000} name="description" className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)]" />
          </label>
          <label className="block text-sm text-[var(--navy)]">
            Bắt đầu
            <input required type="datetime-local" name="startsAt" className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)]" />
          </label>
          <label className="block text-sm text-[var(--navy)]">
            Kết thúc
            <input required type="datetime-local" name="endsAt" className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)]" />
          </label>
        </div>

        <fieldset className="space-y-3 rounded-xl border border-[var(--line)] p-4">
          <legend className="px-1 text-sm font-bold text-[var(--navy)]">Điều kiện và giới hạn</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField label="Số người tối đa" name="participantLimit" defaultValue={200} min={1} max={10000} />
            <NumberField label="Cấp nhà máy tối thiểu" name="minFactoryLevel" defaultValue={1} min={1} max={20} />
            <NumberField label="Gỗ mỗi lượt đóng góp" name="contributionWoodCost" defaultValue={10} min={1} max={10000} />
            <NumberField label="Cooldown (giây)" name="contributionCooldownSeconds" defaultValue={5} min={1} max={3600} />
          </div>
        </fieldset>

        {eventType === "WORLD_BOSS" && (
          <fieldset className="space-y-3 rounded-xl border border-rose-400/30 bg-rose-400/5 p-4">
            <legend className="px-1 text-sm font-bold text-[var(--navy)]">Thông số boss</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Máu boss (HP)" name="bossHp" defaultValue={100000} min={1000} max={100000000} />
              <NumberField label="Thời gian hành quân một chiều (giây)" name="marchTravelSeconds" defaultValue={60} min={30} max={86400} />
            </div>
            <p className="text-xs text-[var(--muted)]">Sát thương tính theo quân đến nơi; đạo quân sẽ quay về, mất khoảng 10% quân số.</p>
          </fieldset>
        )}

        <fieldset className="space-y-3 rounded-xl border border-[var(--line)] p-4">
          <legend className="px-1 text-sm font-bold text-[var(--navy)]">Phần thưởng theo thứ hạng</legend>
          {[1, 2, 3].map((place) => (
            <div key={place} className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(120px,1fr)_1fr_1fr]">
              <p className="col-span-2 self-center text-sm font-semibold text-[var(--navy)] sm:col-span-1">Hạng {place}</p>
              <NumberField label="Gỗ" name={`${["", "first", "second", "third"][place]}RewardWood`} defaultValue={[0, 500, 300, 150][place]} max={100000} />
              <NumberField label="Đá" name={`${["", "first", "second", "third"][place]}RewardStone`} defaultValue={[0, 250, 150, 75][place]} max={100000} />
            </div>
          ))}
          <p className="text-xs text-[var(--muted)]">Top 3 nhận thưởng; nếu bằng điểm, người đạt điểm đó sớm hơn xếp trên.</p>
        </fieldset>

        <button type="submit" disabled={busy} className="rounded-lg bg-[var(--teal)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "Đang tạo…" : "Tạo sự kiện"}
        </button>
      </form>

      <section>
        <div className="mb-3">
          <h2 className="text-xl font-bold text-[var(--navy)]">Sự kiện đã lên lịch</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Có thể đổi lịch hoặc hủy sự kiện quản trị trước khi bắt đầu.</p>
        </div>
        {initialEvents.length === 0 ? (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-6 text-center text-sm text-[var(--muted)]">Chưa có sự kiện.</p>
        ) : (
          <div className="space-y-3">
            {initialEvents.map((event) => (
              <article key={event.id} className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[var(--navy)]">{event.eventType === "WORLD_BOSS" ? "🐲 " : ""}{event.title}</h3>
                      <span className="rounded-full bg-[var(--teal)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--teal)]">{statusLabel(event.status)}</span>
                      {event.slug.startsWith("custom-") && <span className="text-xs text-[var(--muted)]">Quản trị</span>}
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">{event.description}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {localTimeLabel(event.startsAt)} – {localTimeLabel(event.endsAt)} · {event.registeredCount}/{event.participantLimit} người · Nhà máy cấp {event.minFactoryLevel}+ · {event.contributionWoodCost} gỗ/lượt · cooldown {event.contributionCooldownSeconds}s
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Thưởng: {event.rewards.map((reward, index) => `H${index + 1} ${reward.wood} gỗ/${reward.stone} đá`).join(" · ")}
                    </p>
                    {event.eventType === "WORLD_BOSS" && (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Boss: {event.bossHpRemaining.toLocaleString("vi-VN")}/{event.bossHp.toLocaleString("vi-VN")} HP · hành quân {event.marchTravelSeconds}s một chiều
                      </p>
                    )}
                    {event.job?.status === "FAILED" && (
                      <p role="alert" className="mt-2 text-xs text-rose-600">
                        Tác vụ tổng kết lỗi sau {event.job.attempts} lần thử: {event.job.lastError ?? "Xem log máy chủ."}
                      </p>
                    )}
                  </div>
                </div>
                {event.slug.startsWith("custom-") && event.status === "SCHEDULED" && new Date(event.startsAt) > new Date() && (
                  <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-3">
                    <form
                      onSubmit={(submitEvent) => {
                        submitEvent.preventDefault();
                        void updateEvent(event, "reschedule", submitEvent.currentTarget);
                      }}
                      className="flex flex-1 flex-wrap items-end gap-2"
                    >
                      <label className="text-xs text-[var(--muted)]">
                        Bắt đầu
                        <input required name="startsAt" type="datetime-local" defaultValue={localInputValue(event.startsAt)} className="mt-1 block rounded-md border border-[var(--line)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--ink)]" />
                      </label>
                      <label className="text-xs text-[var(--muted)]">
                        Kết thúc
                        <input required name="endsAt" type="datetime-local" defaultValue={localInputValue(event.endsAt)} className="mt-1 block rounded-md border border-[var(--line)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--ink)]" />
                      </label>
                      <button type="submit" disabled={busyEvent === event.id} className="rounded-md border border-[var(--teal)] px-3 py-2 text-xs font-bold text-[var(--teal)] disabled:opacity-50">
                        Đổi lịch
                      </button>
                    </form>
                    <button
                      type="button"
                      disabled={busyEvent === event.id}
                      onClick={() => {
                        if (window.confirm(`Hủy sự kiện "${event.title}"? Người chơi sẽ không thể tham gia.`)) {
                          void updateEvent(event, "cancel");
                        }
                      }}
                      className="rounded-md border border-rose-400/50 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50"
                    >
                      Hủy sự kiện
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
