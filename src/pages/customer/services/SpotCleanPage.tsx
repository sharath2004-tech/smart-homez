import AppLayout from "@/components/AppLayout";
import { authAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { ChevronLeft, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const MINI_SERVICE_TYPES =
  "deep_cleaning_kitchen,deep_cleaning_bathroom,fixed_sofa_cleaning,fixed_carpet_cleaning,fixed_window_cleaning,fixed_fan_cleaning,fixed_balcony_cleaning,fixed_fridge_cleaning";

const SERVICE_ICONS: Record<string, string> = {
  kitchen: "🍳", bathroom: "🚿", sofa: "🛋️", carpet: "🪣",
  window: "🪟", fan: "🌀", balcony: "🌿", fridge: "❄️",
};

const getIcon = (name: string) => {
  const n = name.toLowerCase();
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (n.includes(key)) return icon;
  }
  return "✨";
};

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
}

const SpotCleanPage = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [profile, setProfile] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [svcData, profileData] = await Promise.all([
          servicesAPI.getAll({ serviceType: MINI_SERVICE_TYPES, isActive: true, limit: 20 }),
          authAPI.getProfile(),
        ]);
        setServices(svcData.services || []);
        setProfile(profileData.user || profileData);
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <AppLayout userType="customer" userName={profile?.name || "Guest"}>
      <div className="max-w-2xl mx-auto pb-24 space-y-5">

        {/* Header */}
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-3">
          <Link
            to="/customer/services"
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-border transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧹</span>
              <h1 className="text-xl font-bold text-foreground">Spot Cleaning</h1>
            </div>
            <p className="text-xs text-muted-foreground">Book individual cleaning tasks — quick, fixed price</p>
          </div>
        </motion.div>

        {/* Feature chips */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 flex-wrap">
          {["Fixed pricing", "1-person team", "Same-day available", "30–90 min"].map((f) => (
            <span key={f} className="text-xs bg-cyan-50 border border-cyan-200 text-cyan-700 px-3 py-1 rounded-full font-medium">
              {f}
            </span>
          ))}
        </motion.div>

        {/* Services grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-4xl mb-3">🧹</p>
            <p className="font-medium">No spot-clean services available in your area yet.</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } }, hidden: {} }}
          >
            {services.map((svc) => (
              <motion.div
                key={svc._id}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
              >
                <div className="text-3xl">{getIcon(svc.name)}</div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-sm leading-tight">{svc.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{svc.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{svc.duration} min</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-bold text-green-700 text-base">₹{svc.price.toLocaleString("en-IN")}</span>
                  <Link
                    to={`/customer/book/${svc._id}`}
                    className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    Book →
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default SpotCleanPage;
