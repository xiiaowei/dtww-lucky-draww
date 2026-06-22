"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Draw = {
  id: string;
  draw_number: number;
  prize: string;
  slot_price: number;
};

export default function DrawHistoryPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDraws();
  }, []);

  async function loadDraws() {
    const { data } = await supabase
      .from("lucky_draws")
      .select("*")
      .order("draw_number", { ascending: false });

    setDraws(data || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-xl font-black text-black">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl bg-black p-5 text-white shadow">
          <h1 className="text-2xl font-black">📚 Draw History</h1>
          <p className="mt-1 text-sm text-gray-300">
            View old Lucky Draw records
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {draws.map((draw) => (
            <Link
              key={draw.id}
              href={`/draws/${draw.draw_number}`}
              className="rounded-2xl bg-white p-4 shadow"
            >
              <p className="text-xl font-black text-black">
                Draw #{draw.draw_number.toString().padStart(3, "0")}
              </p>
              <p className="mt-1 font-bold text-black">🏆 {draw.prize}</p>
              <p className="mt-1 text-sm font-bold text-gray-500">
                RM{draw.slot_price} / Slot
              </p>
            </Link>
          ))}
        </div>

        <Link
          href="/"
          className="mt-4 block rounded-xl bg-black p-3 text-center font-black text-white"
        >
          Back to Current Draw
        </Link>
      </div>
    </main>
  );
}