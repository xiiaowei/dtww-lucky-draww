"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type SlotStatus = "available" | "reserved" | "paid";

type Slot = {
  id?: string;
  number: string;
  customer: string;
  status: SlotStatus;
};

type Draw = {
  id: string;
  draw_number: number;
  prize: string;
  slot_price: number;
};

function slotColor(status: SlotStatus) {
  if (status === "paid") return "bg-red-500 text-white border-red-600";
  if (status === "reserved") return "bg-yellow-400 text-black border-yellow-500";
  return "bg-white text-black border-gray-300";
}

export default function CustomerPage() {
  const [draw, setDraw] = useState<Draw | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCustomer, setSearchCustomer] = useState("");

  const paidCount = slots.filter((s) => s.status === "paid").length;
  const reservedCount = slots.filter((s) => s.status === "reserved").length;
  const availableCount = slots.filter((s) => s.status === "available").length;
  const soldCount = paidCount + reservedCount;

  const searchedSlots = searchCustomer.trim()
    ? slots.filter((slot) =>
        slot.customer.toLowerCase().includes(searchCustomer.trim().toLowerCase())
      )
    : [];

  useEffect(() => {
    loadLatestDraw();

    const interval = setInterval(() => {
      loadLatestDraw();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function loadLatestDraw() {
    const { data: drawData, error: drawError } = await supabase
      .from("lucky_draws")
      .select("*")
      .order("draw_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawError || !drawData) {
      setLoading(false);
      return;
    }

    setDraw(drawData);

    const { data: slotData } = await supabase
      .from("lucky_draw_slots")
      .select("*")
      .eq("draw_id", drawData.id)
      .order("slot_number", { ascending: true });

    setSlots(
      (slotData || []).map((s) => ({
        id: s.id,
        number: s.slot_number,
        customer: s.customer || "",
        status: s.status as SlotStatus,
      }))
    );

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-xl font-black text-black">Loading...</p>
      </main>
    );
  }

  if (!draw) {
    return (
      <main className="min-h-screen bg-gray-100 p-4">
        <p className="text-black">No Lucky Draw found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-3">
      <div className="mx-auto max-w-md pb-10">
        <div className="rounded-2xl bg-black p-5 text-white shadow">
          <h1 className="text-2xl font-bold">🐔 DTWW Lucky Draw</h1>
          <p className="mt-1 text-sm text-gray-300">
            Draw #{draw.draw_number.toString().padStart(3, "0")}
          </p>

          <div className="mt-4 rounded-xl bg-white p-4 text-black">
            <p className="text-lg font-bold">🏆 {draw.prize}</p>
            <p className="mt-1 text-2xl font-black">
              💰 RM{draw.slot_price} / Slot
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 text-center shadow">
            <p className="text-xs font-bold text-gray-500">Taken</p>
            <p className="text-2xl font-black text-black">{soldCount}</p>
          </div>

          <div className="rounded-2xl bg-white p-4 text-center shadow">
            <p className="text-xs font-bold text-gray-500">Paid</p>
            <p className="text-2xl font-black text-red-600">{paidCount}</p>
          </div>

          <div className="rounded-2xl bg-white p-4 text-center shadow">
            <p className="text-xs font-bold text-gray-500">Available</p>
            <p className="text-2xl font-black text-green-600">{availableCount}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-4 shadow">
          <p className="font-black text-black">🔍 Check Your Number</p>

          <input
            value={searchCustomer}
            onChange={(e) => setSearchCustomer(e.target.value)}
            placeholder="Enter your name / nickname"
            className="mt-3 w-full rounded-xl border p-3 text-black outline-none focus:border-black"
          />

          {searchCustomer.trim() && (
            <div className="mt-3 rounded-xl bg-gray-100 p-3 text-black">
              {searchedSlots.length > 0 ? (
                <>
                  <p className="font-bold">Your number:</p>
                  <p className="text-xl font-black">
                    {searchedSlots.map((slot) => slot.number).join(", ")}
                  </p>
                </>
              ) : (
                <p className="font-bold">No number found.</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 rounded-2xl bg-white p-3 shadow">
          <div className="flex justify-between text-xs font-bold text-black">
            <span>🔴 Sold</span>
            <span>🟡 Reserved</span>
            <span>⚪ Available</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {slots.map((slot) => (
            <div
              key={slot.number}
              className={`h-16 rounded-xl border text-center text-sm font-black shadow ${slotColor(
                slot.status
              )}`}
            >
              <div className="pt-2">{slot.number}</div>
              <div className="truncate px-1 text-xs">
                {slot.customer || "-"}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          Page auto updates every 10 seconds.
        </p>
      </div>
    </main>
  );
}