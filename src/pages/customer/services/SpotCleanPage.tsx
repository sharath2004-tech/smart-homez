import AppLayout from "@/components/AppLayout";
import { authAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { ChevronLeft, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const ALL_MINI_SERVICE_TYPES =
  "deep_cleaning_kitchen,deep_cleaning_bathroom,fixed_sofa_cleaning,fixed_carpet_cleaning,fixed_window_cleaning,fixed_fan_cleaning,fixed_balcony_cleaning,fixed_fridge_cleaning,fixed_microwave_cleaning,fixed_oven_cleaning,fixed_stove_cleaning,fixed_chimney_cleaning,fixed_kitchen_platform_cleaning,fixed_sink_cleaning,kitchen_appliances_package,fixed_washbasin_cleaning,fixed_window_mesh_cleaning,fixed_washroom_basic,fixed_washroom_deep,fixed_dining_cleaning,fixed_cabinet_cleaning,fixed_utility_cleaning,fixed_cupboard_cleaning,bedroom_package,fixed_bed_cleaning,fixed_mirror_cleaning,fixed_ac_indoor_cleaning,fixed_ac_outdoor_cleaning,fixed_door_cleaning";

const PAGE_CONFIG: Record<string, {
  title: string;
  subtitle: string;
  icon: string;
  serviceTypes: string;
  featureChips: string[];
  emptyMessage: string;
}> = {
  '/customer/services/spot-clean': {
    title: 'Spot Cleaning',
    subtitle: 'Book individual cleaning tasks — quick, fixed price',
    icon: '🧹',
    serviceTypes: ALL_MINI_SERVICE_TYPES,
    featureChips: ['Fixed pricing', '1-person team', 'Same-day available', '30–90 min'],
    emptyMessage: 'No spot-clean services available in your area yet.',
  },
  '/customer/services/intense-washroom-cleaning': {
    title: 'Intense Washroom Cleaning',
    subtitle: 'Deep washroom cleanup for tiles, fittings, and hard-water buildup',
    icon: '🚿',
    serviceTypes: 'fixed_washroom_basic,fixed_washroom_deep,deep_cleaning_bathroom,fixed_washbasin_cleaning',
    featureChips: ['Deep sanitize', 'Bathroom specialists', 'Fixture detailing', '30–90 min'],
    emptyMessage: 'No intense washroom cleaning services are active right now.',
  },
  '/customer/services/kitchen-deep-clean': {
    title: 'Kitchen Deep Clean',
    subtitle: 'Grease removal, appliance detailing, and kitchen surface restoration',
    icon: '🍽️',
    serviceTypes: 'deep_cleaning_kitchen,fixed_microwave_cleaning,fixed_oven_cleaning,fixed_stove_cleaning,fixed_chimney_cleaning,fixed_kitchen_platform_cleaning,fixed_sink_cleaning,kitchen_appliances_package',
    featureChips: ['Grease removal', 'Appliance cleaning', 'Kitchen surfaces', '45–120 min'],
    emptyMessage: 'No kitchen deep-clean services are active right now.',
  },
  '/customer/services/window-deep-cleaning': {
    title: 'Window Deep Cleaning',
    subtitle: 'Glass, frames, tracks, and mesh cleaning with fixed-price booking',
    icon: '🪟',
    serviceTypes: 'fixed_window_cleaning,fixed_window_mesh_cleaning',
    featureChips: ['Glass polishing', 'Frame detailing', 'Track cleaning', '30–90 min'],
    emptyMessage: 'No window deep-cleaning services are active right now.',
  },
};

const SERVICE_ICONS: Record<string, string> = {
  kitchen: "🍳", bathroom: "🚿", sofa: "🛋️", carpet: "🪣",
  window: "🪟", fan: "🌀", balcony: "🌿", fridge: "❄️", washroom: '🚿',
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
  const location = useLocation();
  const [services, setServices] = useState<Service[]>([]);
  const [profile, setProfile] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const pageConfig = PAGE_CONFIG[location.pathname] || PAGE_CONFIG['/customer/services/spot-clean'];

  useEffect(() => {
    const fetch = async () => {
      try {
        const [svcData, profileData] = await Promise.all([
          servicesAPI.getAll({ serviceType: pageConfig.serviceTypes, isActive: true, limit: 20 }),
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
  }, [pageConfig.serviceTypes]);

  return (
    <AppLayout userType="customer" userName={profile?.name || "Guest"}>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 md:px-6 pb-24 space-y-5">

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
              <span className="text-2xl">{pageConfig.icon}</span>
              <h1 className="text-xl font-bold text-foreground">{pageConfig.title}</h1>
            </div>
            <p className="text-xs text-muted-foreground">{pageConfig.subtitle}</p>
          </div>
        </motion.div>

        {/* Feature chips */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 flex-wrap">
          {pageConfig.featureChips.map((f) => (
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
            <p className="text-4xl mb-3">{pageConfig.icon}</p>
            <p className="font-medium">{pageConfig.emptyMessage}</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } }, hidden: {} }}
          >
            {services.map((svc) => (
              <motion.div
                key={svc._id}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                className="bg-card border border-border rounded-2xl p-4 sm:p-5 md:p-6 flex flex-col gap-2 hover:shadow-md transition-shadow"
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
