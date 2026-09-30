import { useEffect, useMemo, useState } from "react";
import { format, addDays } from "date-fns";
import { CheckCircle2, Clock3, CreditCard, Loader2 } from "lucide-react";

type Service = { id: number; name: string; description?: string | null; duration: number; price: number };
type StaffSlots = { staffId: number; staffName: string; staffColor?: string | null; slots: string[] };
type BookingStatus = {
  appointmentId: number; status: string; paymentStatus: string; date: string; startTime: string;
  endTime: string; totalPrice: number; clientName: string | null; staffName: string | null; serviceName: string | null;
};

const API = import.meta.env.VITE_API_BASE_URL ?? "";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Something went wrong");
  return data as T;
}

export default function PublicBooking() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("booking");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [time, setTime] = useState("");
  const [availability, setAvailability] = useState<StaffSlots[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState<BookingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState("");

  const selectedService = useMemo(() => services.find(s => String(s.id) === serviceId), [services, serviceId]);
  const selectedStaff = useMemo(() => availability.find(s => String(s.staffId) === staffId), [availability, staffId]);

  useEffect(() => {
    document.title = "Book an Appointment | Complete Accounting Solutions";
    api<Service[]>("/api/public/booking/services").then(setServices).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!token) return;
    api<BookingStatus>(`/api/public/booking/${token}`).then(setBooking).catch(e => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (!serviceId || !date) { setAvailability([]); return; }
    setLoadingSlots(true);
    setError("");
    api<{ staff: StaffSlots[] }>(`/api/public/booking/availability?serviceId=${serviceId}&date=${date}`)
      .then(data => {
        setAvailability(data.staff);
        setStaffId(current => data.staff.some(s => String(s.staffId) === current) ? current : "");
        setTime("");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingSlots(false));
  }, [serviceId, date]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!serviceId || !staffId || !time || !name || !phone) return;
    setLoading(true);
    setError("");
    try {
      const result = await api<{ bookingToken: string; paymentUrl: string }>("/api/public/booking", {
        method: "POST",
        body: JSON.stringify({ name, phone, email: email || undefined, serviceId: Number(serviceId), staffId: Number(staffId), date, startTime: time }),
      });
      window.location.href = result.paymentUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete booking");
    } finally {
      setLoading(false);
    }
  };

  if (booking) {
    const paid = booking.paymentStatus === "paid";
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <div><p className="text-sm text-muted-foreground">Booking reference #{booking.appointmentId}</p><h1 className="text-2xl font-semibold">Appointment {paid ? "confirmed" : "received"}</h1></div>
          </div>
          <div className="mt-8 grid gap-3 rounded-xl bg-muted/40 p-5 text-sm">
            <div className="flex justify-between"><span>Service</span><strong>{booking.serviceName}</strong></div>
            <div className="flex justify-between"><span>Staff</span><strong>{booking.staffName}</strong></div>
            <div className="flex justify-between"><span>Date</span><strong>{booking.date}</strong></div>
            <div className="flex justify-between"><span>Time</span><strong>{booking.startTime} – {booking.endTime}</strong></div>
            <div className="flex justify-between"><span>Payment</span><strong>{booking.paymentStatus}</strong></div>
            <div className="flex justify-between border-t pt-3"><span>Total</span><strong>AED {booking.totalPrice.toFixed(2)}</strong></div>
          </div>
          {!paid && <p className="mt-5 text-sm text-muted-foreground">Payment is still being processed. This page will show the confirmed status after the payment gateway callback.</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-primary">COMPLETE ACCOUNTING SOLUTIONS</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Book an appointment</h1>
          <p className="mt-2 text-muted-foreground">Choose your service, preferred staff member and available time.</p>
        </div>
        <form onSubmit={submit} className="grid gap-6 rounded-2xl border bg-card p-6 shadow-sm md:p-8">
          <section className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Service
              <select className="h-11 rounded-md border bg-background px-3" value={serviceId} onChange={e => setServiceId(e.target.value)} required>
                <option value="">Select a service</option>
                {services.map(service => <option key={service.id} value={service.id}>{service.name} — AED {service.price.toFixed(2)} · {service.duration} min</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">Date
              <input className="h-11 rounded-md border bg-background px-3" type="date" min={format(new Date(), "yyyy-MM-dd")} value={date} onChange={e => setDate(e.target.value)} required />
            </label>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4" />Available staff & times</div>
            {loadingSlots ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking availability...</div> : (
              <div className="grid gap-3">
                {availability.map(staff => (
                  <div key={staff.staffId} className={`rounded-xl border p-4 ${staffId === String(staff.staffId) ? "border-primary" : ""}`}>
                    <button type="button" className="mb-3 text-left font-medium" onClick={() => { setStaffId(String(staff.staffId)); setTime(""); }}>{staff.staffName}</button>
                    <div className="flex flex-wrap gap-2">
                      {staff.slots.map(slot => <button key={slot} type="button" onClick={() => { setStaffId(String(staff.staffId)); setTime(slot); }} className={`rounded-md border px-3 py-2 text-sm ${staffId === String(staff.staffId) && time === slot ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{slot}</button>)}
                      {staff.slots.length === 0 && <span className="text-sm text-muted-foreground">No times available.</span>}
                    </div>
                  </div>
                ))}
                {!availability.length && serviceId && <p className="text-sm text-muted-foreground">No staff availability for this date.</p>}
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Name<input className="h-11 rounded-md border bg-background px-3" value={name} onChange={e => setName(e.target.value)} required /></label>
            <label className="grid gap-2 text-sm font-medium">Phone<input className="h-11 rounded-md border bg-background px-3" value={phone} onChange={e => setPhone(e.target.value)} required /></label>
            <label className="grid gap-2 text-sm font-medium md:col-span-2">Email <span className="font-normal text-muted-foreground">(optional)</span><input className="h-11 rounded-md border bg-background px-3" type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          </section>

          {selectedService && selectedStaff && time && <div className="rounded-xl bg-muted/50 p-4 text-sm"><div className="flex items-center gap-2 font-medium"><CreditCard className="h-4 w-4" />{selectedService.name} with {selectedStaff.staffName} at {time}</div><p className="mt-1 text-muted-foreground">Total: AED {selectedService.price.toFixed(2)}. Payment is completed securely before the appointment is confirmed.</p></div>}
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          <button disabled={loading || !selectedStaff || !time} className="h-12 rounded-md bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50">{loading ? "Preparing secure payment..." : "Continue to payment"}</button>
        </form>
      </div>
    </main>
  );
}
