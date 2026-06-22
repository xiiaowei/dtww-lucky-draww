"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type SlotStatus = "available" | "reserved" | "paid";
type PaymentAccount = "" | "Daniel" | "Admin";

type Slot = {
  id?: string;
  number: string;
  customer: string;
  status: SlotStatus;
  payment_account: PaymentAccount;
  paid_at: string | null;
};

type Draw = {
  id: string;
  draw_number: number;
  prize: string;
  slot_price: number;
};

function createEmptySlots(): Slot[] {
  return Array.from({ length: 100 }, (_, i) => ({
    number: i.toString().padStart(2, "0"),
    customer: "",
    status: "available",
    payment_account: "",
    paid_at: null,
  }));
}

export default function Home() {
  const [draw, setDraw] = useState<Draw | null>(null);
  const [slots, setSlots] = useState<Slot[]>(createEmptySlots());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [customerInput, setCustomerInput] = useState("");

  const [bulkCustomer, setBulkCustomer] = useState("");
  const [bulkSlots, setBulkSlots] = useState("");
  const [bulkPaymentAccount, setBulkPaymentAccount] =
    useState<PaymentAccount>("Daniel");

  const [searchCustomer, setSearchCustomer] = useState("");
  const [winningNumber, setWinningNumber] = useState("");

  const slotPrice = Number(draw?.slot_price || 13);

  const paidCount = slots.filter((s) => s.status === "paid").length;
  const reservedCount = slots.filter((s) => s.status === "reserved").length;
  const availableCount = slots.filter((s) => s.status === "available").length;
  const soldCount = paidCount + reservedCount;

  const totalExpected = soldCount * slotPrice;
  const totalCollection = paidCount * slotPrice;
  const unpaidCollection = reservedCount * slotPrice;

  const danielPaidCount = slots.filter(
    (s) => s.status === "paid" && s.payment_account === "Daniel"
  ).length;
  const adminPaidCount = slots.filter(
    (s) => s.status === "paid" && s.payment_account === "Admin"
  ).length;
  const unknownPaidCount = slots.filter(
    (s) => s.status === "paid" && !s.payment_account
  ).length;

  const danielCollection = danielPaidCount * slotPrice;
  const adminCollection = adminPaidCount * slotPrice;
  const unknownCollection = unknownPaidCount * slotPrice;

  const searchedSlots = searchCustomer.trim()
    ? slots.filter((slot) =>
        slot.customer.toLowerCase().includes(searchCustomer.trim().toLowerCase())
      )
    : [];

  const winnerSlot = winningNumber.trim()
    ? slots.find((slot) => slot.number === winningNumber.trim().padStart(2, "0"))
    : null;

  useEffect(() => {
    loadLatestDraw();
  }, []);

  async function loadLatestDraw() {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data: drawData, error: drawError } = await supabase
        .from("lucky_draws")
        .select("*")
        .order("draw_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (drawError) {
        setErrorMessage(drawError.message);
        setLoading(false);
        return;
      }

      if (!drawData) {
        await createFirstDraw();
        return;
      }

      setDraw(drawData);

      const { data: slotData, error: slotError } = await supabase
        .from("lucky_draw_slots")
        .select("*")
        .eq("draw_id", drawData.id)
        .order("slot_number", { ascending: true });

      if (slotError) {
        setErrorMessage(slotError.message);
        setLoading(false);
        return;
      }

      if (!slotData || slotData.length === 0) {
        await supabase.from("lucky_draw_slots").insert(
          createEmptySlots().map((slot) => ({
            draw_id: drawData.id,
            slot_number: slot.number,
            customer: "",
            status: "available",
            payment_account: "",
            paid_at: null,
          }))
        );

        await loadLatestDraw();
        return;
      }

      setSlots(
        slotData.map((s) => ({
          id: s.id,
          number: s.slot_number,
          customer: s.customer || "",
          status: s.status as SlotStatus,
          payment_account: (s.payment_account || "") as PaymentAccount,
          paid_at: s.paid_at || null,
        }))
      );

      setLoading(false);
    } catch (err) {
      setErrorMessage(String(err));
      setLoading(false);
    }
  }

  async function createFirstDraw() {
    const { data: newDraw, error: createDrawError } = await supabase
      .from("lucky_draws")
      .insert({
        draw_number: 1,
        prize: "Ayam Betina",
        slot_price: 13,
      })
      .select()
      .single();

    if (createDrawError || !newDraw) {
      setErrorMessage(createDrawError?.message || "Cannot create first draw.");
      setLoading(false);
      return;
    }

    const { error: createSlotsError } = await supabase
      .from("lucky_draw_slots")
      .insert(
        createEmptySlots().map((slot) => ({
          draw_id: newDraw.id,
          slot_number: slot.number,
          customer: "",
          status: "available",
          payment_account: "",
          paid_at: null,
        }))
      );

    if (createSlotsError) {
      setErrorMessage(createSlotsError.message);
      setLoading(false);
      return;
    }

    await loadLatestDraw();
  }

  async function updateSlot(
    slotNumber: string,
    customer: string,
    status: SlotStatus,
    paymentAccount: PaymentAccount = ""
  ) {
    const currentSlot = slots.find((s) => s.number === slotNumber);

    if (!currentSlot?.id) {
      alert("Slot ID not found.");
      return;
    }

    const updatedCustomer = status === "available" ? "" : customer.trim();
    const updatedPaymentAccount =
      status === "paid" ? paymentAccount || currentSlot.payment_account || "Daniel" : "";
    const updatedPaidAt =
      status === "paid" ? currentSlot.paid_at || new Date().toISOString() : null;

    const { error } = await supabase
      .from("lucky_draw_slots")
      .update({
        customer: updatedCustomer,
        status,
        payment_account: updatedPaymentAccount,
        paid_at: updatedPaidAt,
      })
      .eq("id", currentSlot.id);

    if (error) {
      alert(error.message);
      return;
    }

    setSlots((prev) =>
      prev.map((slot) =>
        slot.number === slotNumber
          ? {
              ...slot,
              customer: updatedCustomer,
              status,
              payment_account: updatedPaymentAccount,
              paid_at: updatedPaidAt,
            }
          : slot
      )
    );
  }

  function openSlot(slot: Slot) {
    setSelectedSlot(slot);
    setCustomerInput(slot.customer);
  }

  async function updateSelectedSlot(status: SlotStatus, account: PaymentAccount = "") {
    if (!selectedSlot) return;

    await updateSlot(selectedSlot.number, customerInput, status, account);

    setSelectedSlot(null);
    setCustomerInput("");
  }

  function parseSlotNumbers(input: string): string[] {
    return input
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.padStart(2, "0"))
      .filter((item) => Number(item) >= 0 && Number(item) <= 99);
  }

  async function bulkUpdate(status: "reserved" | "paid") {
    if (!bulkCustomer.trim()) {
      alert("Please enter customer name.");
      return;
    }

    if (status === "paid" && !bulkPaymentAccount) {
      alert("Please choose payment account.");
      return;
    }

    const numbers = parseSlotNumbers(bulkSlots);

    if (numbers.length === 0) {
      alert("Please enter slot numbers.");
      return;
    }

    const occupiedSlots = numbers.filter((number) => {
      const slot = slots.find((s) => s.number === number);
      return slot && slot.status !== "available";
    });

    if (occupiedSlots.length > 0) {
      alert(
        `These slots are already taken:\n${occupiedSlots.join(
          ", "
        )}\n\nPlease choose other slots.`
      );
      return;
    }

    for (const number of numbers) {
      await updateSlot(number, bulkCustomer, status, status === "paid" ? bulkPaymentAccount : "");
    }

    setBulkCustomer("");
    setBulkSlots("");
  }

  async function startNewDraw() {
    if (!draw) return;

    const prize = window.prompt("Prize name:", draw.prize);
    if (!prize) return;

    const priceText = window.prompt("Slot price:", String(draw.slot_price));
    if (!priceText) return;

    const price = Number(priceText);
    if (!price || price <= 0) {
      alert("Invalid price.");
      return;
    }

    const confirmNew = window.confirm(
      "Start new Lucky Draw? Current draw will remain in database, but screen will switch to new draw."
    );

    if (!confirmNew) return;

    const { data: newDraw, error: drawError } = await supabase
      .from("lucky_draws")
      .insert({
        draw_number: draw.draw_number + 1,
        prize,
        slot_price: price,
      })
      .select()
      .single();

    if (drawError || !newDraw) {
      alert(drawError?.message || "Cannot create new draw.");
      return;
    }

    const { error: slotError } = await supabase.from("lucky_draw_slots").insert(
      createEmptySlots().map((slot) => ({
        draw_id: newDraw.id,
        slot_number: slot.number,
        customer: "",
        status: "available",
        payment_account: "",
        paid_at: null,
      }))
    );

    if (slotError) {
      alert(slotError.message);
      return;
    }

    setSearchCustomer("");
    setWinningNumber("");
    await loadLatestDraw();
  }

  function slotColor(slot: Slot) {
    if (slot.status === "paid" && slot.payment_account === "Daniel")
      return "bg-green-600 text-white border-green-700";
    if (slot.status === "paid" && slot.payment_account === "Admin")
      return "bg-blue-600 text-white border-blue-700";
    if (slot.status === "paid") return "bg-green-500 text-white border-green-600";
    if (slot.status === "reserved")
      return "bg-yellow-400 text-black border-yellow-500";
    return "bg-white text-black border-gray-300";
  }

  function copyWhatsAppList() {
    const text = slots
      .map((slot) => {
        const icon =
          slot.status === "paid"
            ? slot.payment_account === "Admin"
              ? "✅ Admin"
              : "✅ Daniel"
            : slot.status === "reserved"
            ? "🧧 Pending"
            : "";
        return `${slot.number} = ${slot.customer || ""} ${icon}`.trim();
      })
      .join("\n");

    navigator.clipboard.writeText(text);
    alert("WhatsApp list copied.");
  }

  function copyPaymentSummary() {
    if (!draw) return;

    const pendingList = slots
      .filter((slot) => slot.status === "reserved")
      .map((slot) => `${slot.number} ${slot.customer}`)
      .join("\n");

    const text = `📊 DTWW Lucky Draw #${draw.draw_number
      .toString()
      .padStart(3, "0")} Payment Summary

Prize: ${draw.prize}
Slot Price: RM${draw.slot_price}

Sold: ${soldCount}/100
Paid: ${paidCount}
Pending: ${reservedCount}
Available: ${availableCount}

Daniel Account: RM${danielCollection} (${danielPaidCount} slots)
Admin Account: RM${adminCollection} (${adminPaidCount} slots)
Unknown Account: RM${unknownCollection} (${unknownPaidCount} slots)

Total Collected: RM${totalCollection}
Pending Collection: RM${unpaidCollection}
Expected Total: RM${totalExpected}

Pending List:
${pendingList || "No pending payment."}`;

    navigator.clipboard.writeText(text);
    alert("Payment summary copied.");
  }

  function copyWinnerText() {
    if (!winnerSlot || !draw) return;

    const text = `🏆 WINNER LUCKY DRAW #${draw.draw_number
      .toString()
      .padStart(3, "0")}\n\nPrize: ${draw.prize}\nWinning Number: ${
      winnerSlot.number
    }\nWinner: ${winnerSlot.customer || "No customer"}`;

    navigator.clipboard.writeText(text);
    alert("Winner text copied.");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-xl font-black text-black">Loading...</p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-red-50 p-4">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-5 shadow">
          <h1 className="text-2xl font-black text-red-600">Supabase Error</h1>
          <p className="mt-3 whitespace-pre-wrap text-black">{errorMessage}</p>
          <button
            onClick={loadLatestDraw}
            className="mt-4 w-full rounded-xl bg-black p-3 font-black text-white"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!draw) {
    return (
      <main className="min-h-screen bg-gray-100 p-4">
        <p className="text-black">No draw found.</p>
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
            <p className="mt-1 text-2xl font-black text-black">
              💰 RM{draw.slot_price} / Slot
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 text-center shadow">
            <p className="text-sm font-bold text-gray-500">Sold</p>
            <p className="text-2xl font-black text-black">{soldCount}/100</p>
          </div>

          <div className="rounded-2xl bg-white p-4 text-center shadow">
            <p className="text-sm font-bold text-gray-500">Total Collected</p>
            <p className="text-2xl font-black text-black">RM{totalCollection}</p>
          </div>

          <div className="rounded-2xl bg-white p-4 text-center shadow">
            <p className="text-sm font-bold text-gray-500">Daniel Account</p>
            <p className="text-2xl font-black text-green-700">
              RM{danielCollection}
            </p>
            <p className="text-xs font-bold text-gray-500">
              {danielPaidCount} slots
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 text-center shadow">
            <p className="text-sm font-bold text-gray-500">Admin Account</p>
            <p className="text-2xl font-black text-blue-700">
              RM{adminCollection}
            </p>
            <p className="text-xs font-bold text-gray-500">
              {adminPaidCount} slots
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 text-center shadow">
            <p className="text-sm font-bold text-gray-500">Paid</p>
            <p className="text-2xl font-black text-green-600">{paidCount}</p>
          </div>

          <div className="rounded-2xl bg-white p-4 text-center shadow">
            <p className="text-sm font-bold text-gray-500">Pending Payment</p>
            <p className="text-2xl font-black text-yellow-600">
              RM{unpaidCollection}
            </p>
            <p className="text-xs font-bold text-gray-500">
              {reservedCount} slots
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-4 shadow">
          <p className="font-black text-black">⚡ Bulk Add</p>

          <input
            value={bulkCustomer}
            onChange={(e) => setBulkCustomer(e.target.value)}
            placeholder="Customer, example: MAXX"
            className="mt-3 w-full rounded-xl border p-3 text-black outline-none focus:border-black"
          />

          <input
            value={bulkSlots}
            onChange={(e) => setBulkSlots(e.target.value)}
            placeholder="Slots, example: 35,36,37"
            className="mt-3 w-full rounded-xl border p-3 text-black outline-none focus:border-black"
          />

          <select
            value={bulkPaymentAccount}
            onChange={(e) =>
              setBulkPaymentAccount(e.target.value as PaymentAccount)
            }
            className="mt-3 w-full rounded-xl border p-3 text-black outline-none focus:border-black"
          >
            <option value="Daniel">Daniel Account</option>
            <option value="Admin">Admin Account</option>
          </select>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={() => bulkUpdate("reserved")}
              className="rounded-xl bg-yellow-400 p-3 font-black text-black"
            >
              Reserve / Pending
            </button>

            <button
              onClick={() => bulkUpdate("paid")}
              className="rounded-xl bg-green-500 p-3 font-black text-white"
            >
              Paid
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-4 shadow">
          <p className="font-black text-black">🔍 Search Customer</p>

          <input
            value={searchCustomer}
            onChange={(e) => setSearchCustomer(e.target.value)}
            placeholder="Example: MAXX"
            className="mt-3 w-full rounded-xl border p-3 text-black outline-none focus:border-black"
          />

          {searchCustomer.trim() && (
            <div className="mt-3 rounded-xl bg-gray-100 p-3 text-black">
              {searchedSlots.length > 0 ? (
                <p className="text-lg font-black">
                  {searchedSlots
                    .map(
                      (slot) =>
                        `${slot.number} ${
                          slot.status === "paid"
                            ? `✅ ${slot.payment_account || "Paid"}`
                            : slot.status === "reserved"
                            ? "🧧 Pending"
                            : ""
                        }`
                    )
                    .join(", ")}
                </p>
              ) : (
                <p className="font-bold">No slot found.</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 rounded-2xl bg-white p-4 shadow">
          <p className="font-black text-black">🏆 Winner Check</p>

          <input
            value={winningNumber}
            onChange={(e) => setWinningNumber(e.target.value)}
            placeholder="Winning number, example: 35"
            maxLength={2}
            className="mt-3 w-full rounded-xl border p-3 text-black outline-none focus:border-black"
          />

          {winningNumber.trim() && winnerSlot && (
            <div className="mt-3 rounded-xl bg-gray-100 p-3 text-black">
              <p className="text-xl font-black">
                Winner: {winnerSlot.customer || "No customer"}
              </p>

              <button
                onClick={copyWinnerText}
                className="mt-3 w-full rounded-xl bg-black p-3 font-black text-white"
              >
                Copy Winner Text
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={startNewDraw}
            className="rounded-xl bg-black p-3 font-black text-white"
          >
            ➕ New Draw
          </button>

          <button
            onClick={copyWhatsAppList}
            className="rounded-xl bg-white p-3 font-black text-black shadow"
          >
            📋 Copy List
          </button>

          <button
            onClick={copyPaymentSummary}
            className="col-span-2 rounded-xl bg-blue-600 p-3 font-black text-white"
          >
            📊 Copy Payment Summary
          </button>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-3 shadow">
          <div className="grid grid-cols-2 gap-2 text-xs font-bold text-black">
            <span>🟢 Daniel Paid</span>
            <span>🔵 Admin Paid</span>
            <span>🟡 Pending</span>
            <span>⚪ Available {availableCount}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {slots.map((slot) => (
            <button
              key={slot.number}
              onClick={() => openSlot(slot)}
              className={`h-16 rounded-xl border text-center text-sm font-black shadow ${slotColor(
                slot
              )}`}
            >
              <div>{slot.number}</div>
              <div className="truncate px-1 text-xs">
                {slot.customer || "-"}
              </div>
              {slot.status === "paid" && (
                <div className="truncate px-1 text-[10px]">
                  {slot.payment_account || "Paid"}
                </div>
              )}
            </button>
          ))}
        </div>

        {selectedSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              <h2 className="text-2xl font-black text-black">
                Slot {selectedSlot.number}
              </h2>

              <input
                value={customerInput}
                onChange={(e) => setCustomerInput(e.target.value)}
                placeholder="Customer name / nickname"
                className="mt-4 w-full rounded-xl border p-3 text-lg text-black outline-none focus:border-black"
              />

              <div className="mt-4 grid gap-3">
                <button
                  onClick={() => updateSelectedSlot("reserved")}
                  className="rounded-xl bg-yellow-400 p-4 text-lg font-black text-black"
                >
                  🟡 Reserve / Pending Payment
                </button>

                <button
                  onClick={() => updateSelectedSlot("paid", "Daniel")}
                  className="rounded-xl bg-green-600 p-4 text-lg font-black text-white"
                >
                  🟢 Paid - Daniel Account
                </button>

                <button
                  onClick={() => updateSelectedSlot("paid", "Admin")}
                  className="rounded-xl bg-blue-600 p-4 text-lg font-black text-white"
                >
                  🔵 Paid - Admin Account
                </button>

                <button
                  onClick={() => updateSelectedSlot("available")}
                  className="rounded-xl bg-red-500 p-4 text-lg font-black text-white"
                >
                  ❌ Clear
                </button>

                <button
                  onClick={() => {
                    setSelectedSlot(null);
                    setCustomerInput("");
                  }}
                  className="rounded-xl bg-gray-200 p-4 text-lg font-black text-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
