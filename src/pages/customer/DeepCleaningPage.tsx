import AppLayout from "@/components/AppLayout";
import { api, authAPI } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, CheckCircle, Clock, MapPin, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ConfigItem {
  id: string;
  category: string;
  name: string;
  description: string;
  pricingType: "fixed" | "per_unit" | "per_sqft" | "tiered";
  price: number;
  tiers?: { label: string; price: number }[];
  maxQty: number;
  unit: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
}
interface DeepCleaningCategory { id: string; label: string; emoji: string; isActive: boolean; sortOrder: number; }
interface DeepCleaningConfig { items: ConfigItem[]; minimumCartValue: number; categories?: DeepCleaningCategory[]; }

// REMOVED: Fallback categories hardcoding. Categories must be managed by admin via backend configuration
// If backend doesn't return categories, show empty state or error instead of hardcoded fallback

interface CartEntry {
  itemId: string; name: string; category: string;
  qty: number; unitPrice: number; totalPrice: number; selectedTier?: string; areaValue?: number | null;
}
type UserProfile = {
  name?: string;
  customerProfile?: { addresses?: { isDefault: boolean; apartment?: string; area?: string; city?: string }[] };
};

// ─── Constants ───────────────────────────────────────────────────────────────
const TIME_SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"];

// ─── Decorative floating sparkles ────────────────────────────────────────────
const FloatingSparkles = () => (
  <div className="relative h-10 flex items-center justify-center overflow-hidden pointer-events-none select-none">
    {[0, 1, 2, 3, 4].map(i => (
      <motion.span
        key={i}
        className="absolute text-base"
        initial={{ y: 8, opacity: 0, x: (i - 2) * 26 }}
        animate={{ y: [4, -4, 4], opacity: [0.25, 0.75, 0.25] }}
        transition={{ duration: 2.2 + i * 0.35, repeat: Infinity, delay: i * 0.28, ease: "easeInOut" }}
      >
        ✨
      </motion.span>
    ))}
    <div className="w-full h-px bg-gradient-to-r from-transparent via-green-300 to-transparent opacity-60" />
  </div>
);

// ─── Animated price total ────────────────────────────────────────────────────
const AnimatedTotal = ({ value }: { value: number }) => (
  <AnimatePresence mode="popLayout">
    <motion.span
      key={value}
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 8, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      className="inline-block tabular-nums"
    >
      ₹{value.toLocaleString("en-IN")}
    </motion.span>
  </AnimatePresence>
);

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function DeepCleaningPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState<DeepCleaningConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("bathroom");
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [sqftValues, setSqftValues] = useState<Record<string, string>>({});
  const [tierSelects, setTierSelects] = useState<Record<string, number>>({});
  const [pulsedItem, setPulsedItem] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState(false);
  const prevCat = useRef("bathroom");

  useEffect(() => {
    Promise.all([
      api.get("/deep-cleaning/config"),
      authAPI.getProfile().catch(() => null),
    ]).then(([cfg, prof]) => {
      setConfig(cfg.config);
      setProfile(prof?.user || prof);
      const requestedCategory = searchParams.get("category");
      // Set active category to first active category from config (ONLY from backend, no fallback)
      const cats = (cfg.config?.categories ?? [])
        .filter((c: DeepCleaningCategory) => c.isActive)
        .sort((a: DeepCleaningCategory, b: DeepCleaningCategory) => a.sortOrder - b.sortOrder);
      if (cats.length > 0) {
        const initialCategory = requestedCategory && cats.some((c: DeepCleaningCategory) => c.id === requestedCategory)
          ? requestedCategory
          : cats[0].id;
        setActiveCategory(initialCategory);
        prevCat.current = initialCategory;
      }
    }).finally(() => setLoading(false));
  }, [searchParams]);

  const cartTotal  = useMemo(() => Object.values(cart).reduce((s, e) => s + e.totalPrice, 0), [cart]);
  const cartCount  = useMemo(() => Object.values(cart).reduce((s, e) => s + e.qty, 0), [cart]);
  const minValue   = config?.minimumCartValue ?? 500;
  const belowMin   = cartTotal > 0 && cartTotal < minValue;
  const categories = (config?.categories ?? [])
    .filter(c => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const today      = new Date().toISOString().split("T")[0];
  const defaultAddr = profile?.customerProfile?.addresses?.find(a => a.isDefault)
    ?? profile?.customerProfile?.addresses?.[0];

  const pulse = (id: string) => { setPulsedItem(id); setTimeout(() => setPulsedItem(null), 600); };

  // per_unit / fixed
  const addUnit = (item: ConfigItem) => {
    setCart(prev => {
      const existing = prev[item.id];
      const newQty = Math.min((existing?.qty ?? 0) + 1, item.maxQty ?? 20);
      return { ...prev, [item.id]: { itemId: item.id, name: item.name, category: item.category, qty: newQty, unitPrice: item.price, totalPrice: item.price * newQty } };
    });
    pulse(item.id);
  };
  const removeUnit = (item: ConfigItem) => {
    setCart(prev => {
      const existing = prev[item.id];
      if (!existing || existing.qty <= 1) { const { [item.id]: _, ...rest } = prev; return rest; }
      const q = existing.qty - 1;
      return { ...prev, [item.id]: { ...existing, qty: q, totalPrice: item.price * q } };
    });
  };

  // tiered
  const addTiered = (item: ConfigItem) => {
    const ti = tierSelects[item.id] ?? 0;
    const tier = item.tiers?.[ti];
    if (!tier) return;
    setCart(prev => ({ ...prev, [item.id]: { itemId: item.id, name: `${item.name} — ${tier.label}`, category: item.category, qty: 1, unitPrice: tier.price, totalPrice: tier.price, selectedTier: tier.label } }));
    pulse(item.id);
  };
  const removeTiered = (item: ConfigItem) => setCart(prev => { const { [item.id]: _, ...r } = prev; return r; });

  // per_sqft
  const applySqft = (item: ConfigItem) => {
    const sqft = parseFloat(sqftValues[item.id] ?? "0");
    if (!sqft || sqft <= 0) return;

    api.post("/deep-cleaning/estimate", {
      cartItems: [{ itemId: item.id, qty: 1, areaValue: sqft }],
    }).then((res) => {
      const calculated = res.verifiedCartItems?.[0];
      if (!calculated) return;

      setCart(prev => ({
        ...prev,
        [item.id]: {
          itemId: calculated.itemId,
          name: calculated.name,
          category: calculated.category,
          qty: calculated.qty,
          unitPrice: calculated.unitPrice,
          totalPrice: calculated.totalPrice,
          selectedTier: calculated.selectedTier || undefined,
          areaValue: calculated.areaValue,
        }
      }));
      pulse(item.id);
    }).catch((err) => {
      console.error(err);
    });
  };
  const removeSqft = (item: ConfigItem) => {
    setCart(prev => { const { [item.id]: _, ...r } = prev; return r; });
    setSqftValues(prev => { const { [item.id]: _, ...r } = prev; return r; });
  };

  const handleBook = async () => {
    if (!bookingDate || !bookingTime || booking) return;
    setBooking(true);
    try {
      await api.post("/deep-cleaning/booking", { cartItems: Object.values(cart), totalAmount: cartTotal, bookingDate, startTime: bookingTime });
      setSuccess(true);
      setTimeout(() => navigate("/customer/bookings"), 2200);
    } catch (err) { console.error(err); }
    finally { setBooking(false); }
  };

  const handleCategoryChange = (id: string) => { prevCat.current = activeCategory; setActiveCategory(id); };
  const direction = categories.findIndex(c => c.id === activeCategory) > categories.findIndex(c => c.id === prevCat.current) ? 1 : -1;
  const items = (config?.items ?? []).filter(i => i.isActive && i.category === activeCategory).sort((a, b) => a.sortOrder - b.sortOrder);

  if (loading) return (
    <AppLayout userType="customer" userName={profile?.name}>
      <div className="flex flex-col items-center justify-center py-28 gap-4">
        <motion.div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }} />
        <p className="text-muted-foreground text-sm">Loading services...</p>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout userType="customer" userName={profile?.name}>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 md:px-6 pb-36">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 20 }}
          className="relative overflow-hidden rounded-3xl mb-6 p-6"
          style={{ background: "linear-gradient(135deg,#22c55e 0%,#16a34a 55%,#15803d 100%)" }}
        >
          {/* Decorative blobs */}
          <motion.div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10"
            animate={{ scale: [1, 1.14, 1] }} transition={{ repeat: Infinity, duration: 4.5 }} />
          <motion.div className="absolute bottom-2 left-10 w-20 h-20 rounded-full bg-white/6"
            animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3.5, delay: 0.5 }} />
          <motion.div className="absolute top-1/2 right-16 w-10 w-10 rounded-full bg-white/8"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 2.8, delay: 1 }} />
          <div className="relative z-10">
            <div className="mb-3">
              <Link to="/customer/deep-cleaning" className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white transition-colors">
                ← Back to Deep Cleaning Categories
              </Link>
            </div>
            <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.2 }} className="text-4xl mb-3 inline-block">
              ✨
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-1">Deep Cleaning Booking</h1>
            <p className="text-white/70 text-sm">Choose the services you need, enter your home details and continue to book.</p>
            <div className="mt-3 inline-flex items-center gap-1.5 bg-white/15 text-white text-xs font-medium px-3 py-1.5 rounded-full">
              <ShoppingCart className="w-3 h-3" /> Min cart ₹{minValue}
            </div>
          </div>
        </motion.div>

        {/* ── Category Tabs ─────────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-1 scrollbar-hide">
          {categories.map((cat, i) => {
            const isActive = cat.id === activeCategory;
            const hasItems = Object.values(cart).some(e => e.category === cat.id);
            return (
              <motion.button key={cat.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => handleCategoryChange(cat.id)}
                className={`relative shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-border"
                }`}
              >
                <span>{cat.emoji}</span><span>{cat.label}</span>
                {hasItems && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="w-2 h-2 bg-green-500 rounded-full absolute -top-0.5 -right-0.5" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ── Sparkle divider ───────────────────────────────────────────────── */}
        <FloatingSparkles />

        {/* ── Items ─────────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={activeCategory} custom={direction}
            initial={{ opacity: 0, x: direction * 35 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 35 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="space-y-3"
          >
            {items.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-3xl mb-2">🔧</p>
                <p className="text-sm">No items in this category yet</p>
              </div>
            ) : items.map((item, idx) => (
              <ItemCard key={item.id} item={item} idx={idx}
                cart={cart} sqftValues={sqftValues} tierSelects={tierSelects} pulsedItem={pulsedItem}
                onAddUnit={addUnit} onRemoveUnit={removeUnit}
                onAddTiered={addTiered} onRemoveTiered={removeTiered}
                onApplySqft={applySqft} onRemoveSqft={removeSqft}
                onSqftChange={(id, v) => setSqftValues(p => ({ ...p, [id]: v }))}
                onTierSelect={(id, ti) => setTierSelects(p => ({ ...p, [id]: ti }))}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Sticky Cart Bar ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {cartTotal > 0 && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border p-4"
          >
            <div className="max-w-2xl mx-auto">
              <AnimatePresence>
                {belowMin && (
                  <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-2 text-center overflow-hidden">
                    Add ₹{(minValue - cartTotal).toLocaleString("en-IN")} more to reach minimum ₹{minValue}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <motion.div key={cartCount} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.3 }}
                      className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-4 h-4 text-primary-foreground" />
                    </motion.div>
                    <span className="text-xs text-muted-foreground">{cartCount} item{cartCount !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    <AnimatedTotal value={cartTotal} />
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.95 }} disabled={belowMin}
                  onClick={() => setShowModal(true)}
                  className="btn-brand px-6 py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                  Schedule & Book →
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Booking Modal (bottom sheet) ──────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => !booking && setShowModal(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl p-3 sm:p-4 md:p-5 lg:p-6 max-h-[88vh] overflow-y-auto shadow-2xl"
            >
              {success ? (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center py-10 gap-4">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: 2, duration: 0.4 }}
                    className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </motion.div>
                  <h2 className="text-xl font-bold text-foreground">Booking Confirmed!</h2>
                  <p className="text-muted-foreground text-sm text-center">Redirecting to your bookings...</p>
                </motion.div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-bold text-foreground">Schedule Cleaning</h2>
                    <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Cart summary */}
                  <div className="bg-muted rounded-2xl p-4 mb-5 space-y-1.5">
                    {Object.values(cart).map(e => (
                      <div key={e.itemId} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{e.name}{e.qty > 1 ? ` ×${e.qty}` : ""}</span>
                        <span className="font-semibold">₹{e.totalPrice.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold text-base">
                      <span>Total</span>
                      <span className="text-primary">₹{cartTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="mb-4">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
                      <Calendar className="w-4 h-4 text-primary" /> Select Date
                    </label>
                    <input type="date" min={today} value={bookingDate}
                      onChange={e => setBookingDate(e.target.value)} className="input-clean w-full" />
                  </div>

                  {/* Time */}
                  <div className="mb-4">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
                      <Clock className="w-4 h-4 text-primary" /> Select Start Time
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {TIME_SLOTS.map(slot => (
                        <motion.button key={slot} whileTap={{ scale: 0.92 }}
                          onClick={() => setBookingTime(slot)}
                          className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                            bookingTime === slot ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-border"
                          }`}>
                          {slot}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Address */}
                  {defaultAddr && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="mb-5 flex items-start gap-2 p-3 bg-muted rounded-xl">
                      <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">
                        {[defaultAddr.apartment, defaultAddr.area, defaultAddr.city].filter(Boolean).join(", ")}
                      </span>
                    </motion.div>
                  )}

                  <motion.button whileTap={{ scale: 0.97 }}
                    disabled={!bookingDate || !bookingTime || booking}
                    onClick={handleBook}
                    className="w-full btn-brand py-3.5 text-base font-semibold disabled:opacity-40">
                    {booking ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full"
                          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }} />
                        Confirming...
                      </span>
                    ) : "Confirm Booking ✓"}
                  </motion.button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

// ─── Item Card Component ─────────────────────────────────────────────────────
interface ItemCardProps {
  item: ConfigItem; idx: number;
  cart: Record<string, CartEntry>;
  sqftValues: Record<string, string>;
  tierSelects: Record<string, number>;
  pulsedItem: string | null;
  onAddUnit: (i: ConfigItem) => void;
  onRemoveUnit: (i: ConfigItem) => void;
  onAddTiered: (i: ConfigItem) => void;
  onRemoveTiered: (i: ConfigItem) => void;
  onApplySqft: (i: ConfigItem) => void;
  onRemoveSqft: (i: ConfigItem) => void;
  onSqftChange: (id: string, val: string) => void;
  onTierSelect: (id: string, ti: number) => void;
}

function ItemCard({ item, idx, cart, sqftValues, tierSelects, pulsedItem,
  onAddUnit, onRemoveUnit, onAddTiered, onRemoveTiered,
  onApplySqft, onRemoveSqft, onSqftChange, onTierSelect }: ItemCardProps) {

  const inCart = !!cart[item.id];
  const entry  = cart[item.id];
  const pulsed = pulsedItem === item.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: pulsed ? 1.025 : 1 }}
      transition={{ delay: idx * 0.07, type: "spring", stiffness: 240, damping: 22 }}
      className={`border rounded-2xl p-4 transition-colors ${
        inCart ? "border-green-300 bg-green-50/50" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <motion.div
          animate={{ rotate: pulsed ? [0, -12, 12, 0] : 0, scale: pulsed ? [1, 1.15, 1] : 1 }}
          transition={{ duration: 0.4 }}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
            inCart ? "bg-green-200" : "bg-accent"
          }`}
        >
          {item.icon}
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-foreground text-sm leading-tight">{item.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
            <AnimatePresence>
              {inCart && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  className="shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">✓</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── per_unit ──────────────────────────────────────────────────── */}
          {(item.pricingType === "per_unit" || item.pricingType === "fixed") && (
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground line-through">
                  ₹{Math.round(item.price / 0.8).toLocaleString("en-IN")}
                  {item.pricingType === "per_unit" && <span> / {item.unit}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-green-700">
                    ₹{item.price.toLocaleString("en-IN")}
                    {item.pricingType === "per_unit" && (
                      <span className="text-xs font-normal text-muted-foreground"> / {item.unit}</span>
                    )}
                  </span>
                  <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1 py-0.5 rounded-full">20% off</span>
                </div>
              </div>
              {!inCart ? (
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => onAddUnit(item)}
                  className="text-xs font-semibold bg-primary text-primary-foreground px-4 py-1.5 rounded-xl">
                  + Add
                </motion.button>
              ) : item.pricingType === "fixed" ? (
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => onRemoveUnit(item)}
                  className="text-xs font-semibold bg-green-600 text-white px-4 py-1.5 rounded-xl">
                  ✓ Added
                </motion.button>
              ) : (
                <div className="flex items-center gap-2 bg-primary rounded-xl px-2 py-1.5">
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => onRemoveUnit(item)} className="text-primary-foreground">
                    <Minus className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.span key={entry.qty} initial={{ scale: 0.7 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500 }}
                    className="text-sm font-bold text-primary-foreground w-5 text-center tabular-nums">
                    {entry.qty}
                  </motion.span>
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => onAddUnit(item)}
                    disabled={entry.qty >= (item.maxQty ?? 20)} className="text-primary-foreground disabled:opacity-30">
                    <Plus className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              )}
            </div>
          )}

          {/* ── tiered ────────────────────────────────────────────────────── */}
          {item.pricingType === "tiered" && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {item.tiers?.map((tier, ti) => {
                  const isSelected = (tierSelects[item.id] ?? 0) === ti;
                  const isActive   = inCart && entry.selectedTier === tier.label;
                  return (
                    <motion.button key={ti} whileTap={{ scale: 0.92 }}
                      onClick={() => onTierSelect(item.id, ti)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${
                        isSelected || isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-border"
                      }`}>
                      {tier.label} — <span className="line-through opacity-60">₹{Math.round(tier.price / 0.8).toLocaleString("en-IN")}</span> <span className="font-bold">₹{tier.price.toLocaleString("en-IN")}</span>
                    </motion.button>
                  );
                })}
              </div>
              {!inCart ? (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => onAddTiered(item)}
                  className="w-full text-xs font-semibold bg-primary text-primary-foreground py-2 rounded-xl">
                  Add to Cart
                </motion.button>
              ) : (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => onRemoveTiered(item)}
                  className="w-full text-xs font-semibold bg-green-600 text-white py-2 rounded-xl">
                  ✓ {entry.selectedTier} added — Remove
                </motion.button>
              )}
            </div>
          )}

          {/* ── per_sqft ──────────────────────────────────────────────────── */}
          {item.pricingType === "per_sqft" && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">Enter your home area and we will calculate the amount for you.</p>
              {!inCart ? (
                <div className="flex gap-2">
                  <input type="number" placeholder={`Enter area in ${item.unit || 'sqft'}`} min="1"
                    value={sqftValues[item.id] ?? ""}
                    onChange={e => onSqftChange(item.id, e.target.value)}
                    className="input-clean flex-1 text-sm py-1.5 h-9" />
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => onApplySqft(item)}
                    disabled={!sqftValues[item.id] || Number(sqftValues[item.id]) <= 0}
                    className="text-xs font-semibold bg-primary text-primary-foreground px-4 rounded-xl disabled:opacity-40">
                    Show amount
                  </motion.button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-green-100 rounded-xl px-3 py-2">
                  <span className="text-sm font-semibold text-green-800">
                    {entry.selectedTier} → ₹{entry.totalPrice.toLocaleString("en-IN")}
                  </span>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => onRemoveSqft(item)}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold ml-2">
                    Remove
                  </motion.button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
