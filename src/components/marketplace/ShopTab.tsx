"use client";

import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";

export function ShopTab({
  onPurchase,
}: {
  onPurchase: (packId: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5">
        <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
          <span>🎁</span> Cửa Hàng Gacha Shop &amp; Thẻ Bài Độc Quyền
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Thanh toán tiện lợi bằng <strong>A2 Coin</strong>. Giải bài tập hoặc đổi điểm chuyên cần để nhận thêm coin!
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pack 1 */}
        <Card variant="glass" className="flex flex-col justify-between p-5 group hover:border-sky-500/40">
          <div>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-500/15 text-3xl mb-4 group-hover:scale-110 transition-transform">
              🎫
            </div>
            <Badge variant="info" size="sm" className="mb-2">Gói Cơ Bản</Badge>
            <h3 className="font-bold text-base text-[var(--navy)]">1 Vé Quay Gacha</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Dùng để quay thẻ tại bất kỳ banner gacha đang hoạt động.
            </p>
          </div>
          <div className="mt-6 border-t border-[var(--line)]/50 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[var(--muted)]">Giá bán</span>
              <span className="text-amber-500 font-bold text-base">150 A2C</span>
            </div>
            <Button
              variant="primary"
              className="w-full text-xs font-bold"
              onClick={() => onPurchase("single_ticket")}
            >
              Mua với 150 A2C
            </Button>
          </div>
        </Card>

        {/* Pack 2 */}
        <Card variant="glass" className="flex flex-col justify-between p-5 group hover:border-emerald-500/40">
          <div>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl mb-4 group-hover:scale-110 transition-transform">
              🎒
            </div>
            <Badge variant="success" size="sm" className="mb-2">Gói Ưu Đãi</Badge>
            <h3 className="font-bold text-base text-[var(--navy)]">Túi Tân Thủ (10 Vé)</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Bao gồm 10 vé quay gacha + Tặng kèm 1 thẻ hiếm (Rare) ngẫu nhiên vào kho.
            </p>
          </div>
          <div className="mt-6 border-t border-[var(--line)]/50 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[var(--muted)]">Giá bán</span>
              <span className="text-amber-500 font-bold text-base">1.200 A2C</span>
            </div>
            <Button
              variant="primary"
              className="w-full text-xs font-bold"
              onClick={() => onPurchase("starter_bundle")}
            >
              Mua với 1.200 A2C
            </Button>
          </div>
        </Card>

        {/* Pack 3 */}
        <Card variant="glass" className="flex flex-col justify-between p-5 group hover:border-purple-500/40">
          <div>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-500/15 text-3xl mb-4 group-hover:scale-110 transition-transform">
              📦
            </div>
            <Badge variant="purple" size="sm" className="mb-2">Gói Master</Badge>
            <h3 className="font-bold text-base text-[var(--navy)]">Hộp Thẻ Master</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Gồm 30 vé quay + chắc chắn nhận 1 Thẻ Sử Thi (Epic) mạnh mẽ cho sàn đấu bài.
            </p>
          </div>
          <div className="mt-6 border-t border-[var(--line)]/50 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[var(--muted)]">Giá bán</span>
              <span className="text-amber-500 font-bold text-base">3.200 A2C</span>
            </div>
            <Button
              variant="primary"
              className="w-full text-xs font-bold"
              onClick={() => onPurchase("booster_box")}
            >
              Mua với 3.200 A2C
            </Button>
          </div>
        </Card>

        {/* Pack 4 */}
        <Card variant="glass" className="flex flex-col justify-between p-5 group hover:border-amber-500/40">
          <div>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-3xl mb-4 group-hover:scale-110 transition-transform">
              👑
            </div>
            <Badge variant="warning" size="sm" className="mb-2">Độc Quyền</Badge>
            <h3 className="font-bold text-base text-[var(--navy)]">Rương Huyền Thoại</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Chắc chắn nhận ngay 1 Thẻ Huyền Thoại (Legendary) với chỉ số cực khủng.
            </p>
          </div>
          <div className="mt-6 border-t border-[var(--line)]/50 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[var(--muted)]">Giá bán</span>
              <span className="text-amber-500 font-bold text-base">6.000 A2C</span>
            </div>
            <Button
              variant="primary"
              className="w-full text-xs font-bold"
              onClick={() => onPurchase("exclusive_legendary")}
            >
              Mua với 6.000 A2C
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
