"use client";

import { useCallback, useState } from "react";

export interface WorldRedeemCodeAdminView {
  id: string;
  codePreview: string;
  campaign: string;
  rewardWood: number;
  rewardStone: number;
  rewardFood: number;
  rewardIron: number;
  rewardA2Coin: number;
  maxUses: number;
  perUserLimit: number;
  usedCount: number;
  redemptionCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  enabled: boolean;
  createdAt: string;
  createdByName: string | null;
}

type FormState = {
  campaign: string;
  code: string;
  rewardWood: number;
  rewardStone: number;
  rewardFood: number;
  rewardIron: number;
  rewardA2Coin: number;
  maxUses: number;
  perUserLimit: number;
  expiresAt: string;
};

const emptyForm: FormState = {
  campaign: "",
  code: "",
  rewardWood: 500,
  rewardStone: 300,
  rewardFood: 200,
  rewardIron: 0,
  rewardA2Coin: 0,
  maxUses: 100,
  perUserLimit: 1,
  expiresAt: "",
};

export function WorldRedeemCodeAdmin({
  initialCodes,
}: {
  initialCodes: WorldRedeemCodeAdminView[];
}) {
  const [codes, setCodes] = useState(initialCodes);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [freshCode, setFreshCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/world/redeem-codes", { cache: "no-store" });
    if (!response.ok) return;
    setCodes((await response.json()) as WorldRedeemCodeAdminView[]);
  }, []);

  function setNumber(key: keyof FormState, value: string) {
    const parsed = Number(value);
    setForm((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/admin/world/redeem-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: form.campaign.trim(),
          code: form.code.trim() || null,
          rewardWood: form.rewardWood,
          rewardStone: form.rewardStone,
          rewardFood: form.rewardFood,
          rewardIron: form.rewardIron,
          rewardA2Coin: form.rewardA2Coin,
          maxUses: form.maxUses,
          perUserLimit: form.perUserLimit,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể tạo mã.");
      setFreshCode(result.code as string);
      setMessage("Đã tạo mã. Mã chỉ hiển thị đúng một lần này — hãy sao chép ngay.");
      setForm((prev) => ({ ...emptyForm, campaign: prev.campaign }));
      await load();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Không thể tạo mã.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(code: WorldRedeemCodeAdminView) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/world/redeem-codes/${code.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !code.enabled }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Không thể cập nhật mã.");
      }
      await load();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật mã.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(code: WorldRedeemCodeAdminView) {
    if (!window.confirm(`Xoá mã ${code.codePreview} (${code.campaign})?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/world/redeem-codes/${code.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Không thể xoá mã.");
      }
      await load();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Không thể xoá mã.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-xl font-semibold text-[var(--navy)]">🎁 Mã quà tặng A2 Kingdom</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Mã được lưu dưới dạng băm SHA-256, chỉ hiện dạng che khi quản lý. Phần thưởng được cộng trực tiếp
        vào căn cứ và ví A2 Coin của người chơi.
      </p>

      {message && (
        <p className={`mt-3 rounded-lg p-2 text-sm ${isError ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
          {message}
        </p>
      )}
      {freshCode && (
        <div className="mt-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">Mã vừa tạo</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(freshCode);
            }}
            className="mt-1 font-mono text-lg font-bold tracking-widest text-white hover:underline"
          >
            {freshCode} · sao chép
          </button>
        </div>
      )}

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-[var(--muted)]">
          Chiến dịch
          <input
            required
            value={form.campaign}
            onChange={(event) => setForm((prev) => ({ ...prev, campaign: event.target.value }))}
            placeholder="Quà ra mắt"
            className="mt-1 w-full rounded border border-white/15 bg-black/20 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-[var(--muted)]">
          Mã (để trống = tự tạo)
          <input
            value={form.code}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
            }
            placeholder="A2KINGDOM"
            className="mt-1 w-full rounded border border-white/15 bg-black/20 px-2 py-1.5 font-mono text-sm text-white"
          />
        </label>
        {(["rewardWood", "rewardStone", "rewardFood", "rewardIron", "rewardA2Coin"] as const).map(
          (key) => (
            <label key={key} className="text-xs text-[var(--muted)]">
              {key === "rewardWood"
                ? "Gỗ"
                : key === "rewardStone"
                  ? "Đá"
                  : key === "rewardFood"
                    ? "Lương thực"
                    : key === "rewardIron"
                      ? "Sắt"
                      : "A2 Coin"}
              <input
                type="number"
                min={0}
                value={form[key]}
                onChange={(event) => setNumber(key, event.target.value)}
                className="mt-1 w-full rounded border border-white/15 bg-black/20 px-2 py-1.5 text-sm text-white"
              />
            </label>
          ),
        )}
        <label className="text-xs text-[var(--muted)]">
          Tổng lượt dùng (0 = không giới hạn)
          <input
            type="number"
            min={0}
            value={form.maxUses}
            onChange={(event) => setNumber("maxUses", event.target.value)}
            className="mt-1 w-full rounded border border-white/15 bg-black/20 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-[var(--muted)]">
          Giới hạn mỗi người
          <input
            type="number"
            min={1}
            value={form.perUserLimit}
            onChange={(event) => setNumber("perUserLimit", event.target.value)}
            className="mt-1 w-full rounded border border-white/15 bg-black/20 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-[var(--muted)]">
          Hết hạn
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
            className="mt-1 w-full rounded border border-white/15 bg-black/20 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy || !form.campaign.trim()}
            className="w-full rounded bg-[var(--teal)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Đang xử lý…" : "Tạo mã"}
          </button>
        </div>
      </form>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-semibold text-[var(--navy)]">Danh sách mã ({codes.length})</p>
        {codes.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Chưa có mã quà tặng nào.</p>
        ) : (
          codes.map((code) => (
            <div
              key={code.id}
              className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold tracking-wider">{code.codePreview}</span>{" "}
                  <span className="text-white/60">· {code.campaign}</span>
                  {!code.enabled && (
                    <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-xs text-rose-300">
                      Vô hiệu
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggle(code)}
                    className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-40"
                  >
                    {code.enabled ? "Vô hiệu hoá" : "Kích hoạt"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(code)}
                    className="rounded border border-rose-400/40 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
                  >
                    Xoá
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-white/60">
                +{code.rewardWood}🪵 +{code.rewardStone}🪨 +{code.rewardFood}🌾 +{code.rewardIron}⛏️
                {code.rewardA2Coin > 0 ? ` +${code.rewardA2Coin} A2` : ""} · dùng{" "}
                {code.usedCount}/{code.maxUses || "∞"} · mỗi người {code.perUserLimit}
                {code.expiresAt ? ` · hết hạn ${code.expiresAt.slice(0, 16)}` : ""}
                {code.createdByName ? ` · bởi ${code.createdByName}` : ""}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
