import AppLayout from "@/components/AppLayout";
import { authAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { ChevronLeft, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  serviceCategory?: string;
  displayOrder?: number;
  availability?: { available: boolean };
}

const CATEGORY_META: Record<string, { icon: string; labelKey: string; descKey: string }> = {
  instant_services:       { icon: '⚡', labelKey: 'customer.services.cat.instant',       descKey: 'customer.services.cat.instantDesc' },
  subscription_services:  { icon: '📅', labelKey: 'customer.services.cat.subscription',   descKey: 'customer.services.cat.subscriptionDesc' },
  deep_cleaning:          { icon: '✨', labelKey: 'customer.services.cat.deepCleaning',   descKey: 'customer.services.cat.deepCleaningDesc' },
  spot_cleaning:          { icon: '🧹', labelKey: 'customer.services.cat.spotCleaning',   descKey: 'customer.services.cat.spotCleaningDesc' },
  kitchen_services:       { icon: '🍳', labelKey: 'customer.services.cat.kitchen',        descKey: 'customer.services.cat.kitchenDesc' },
  bathroom_services:      { icon: '🚿', labelKey: 'customer.services.cat.bathroom',       descKey: 'customer.services.cat.bathroomDesc' },
  furniture_services:     { icon: '🛋️', labelKey: 'customer.services.cat.furniture',      descKey: 'customer.services.cat.furnitureDesc' },
  hvac_services:          { icon: '❄️', labelKey: 'customer.services.cat.hvac',           descKey: 'customer.services.cat.hvacDesc' },
  other:                  { icon: '🏠', labelKey: 'customer.services.cat.other',          descKey: 'customer.services.cat.otherDesc' },
};

const getServiceIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('kitchen')) return '🍳';
  if (n.includes('bathroom') || n.includes('washroom')) return '🚿';
  if (n.includes('sofa')) return '🛋️';
  if (n.includes('carpet')) return '🪣';
  if (n.includes('window')) return '🪟';
  if (n.includes('fan')) return '🌀';
  if (n.includes('balcony')) return '🌿';
  if (n.includes('fridge') || n.includes('ac') || n.includes('hvac')) return '❄️';
  if (n.includes('bed')) return '🛏️';
  if (n.includes('mirror')) return '🪞';
  if (n.includes('door')) return '🚪';
  return '✨';
};

export default function CategoryServicePage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [profile, setProfile] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const meta = slug ? (CATEGORY_META[slug] ?? CATEGORY_META['other']) : CATEGORY_META['other'];

  // Resolve category label: use translation if key exists, otherwise prettify the slug
  const categoryLabel = (() => {
    const translated = t(meta.labelKey, '');
    if (translated && translated !== meta.labelKey) return translated;
    return slug ? slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Services';
  })();

  const categoryDesc = (() => {
    const translated = t(meta.descKey, '');
    if (translated && translated !== meta.descKey) return translated;
    return '';
  })();

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        const [svcData, profileData] = await Promise.all([
          servicesAPI.getAll({ serviceCategory: slug, isActive: true, limit: 50 }),
          authAPI.getProfile(),
        ]);
        const sorted = (svcData.services || []).sort(
          (a: Service, b: Service) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
        );
        setServices(sorted);
        setProfile(profileData.user || profileData);
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  return (
    <AppLayout userType="customer" userName={profile?.name || 'Guest'}>
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
              <span className="text-2xl">{meta.icon}</span>
              <h1 className="text-xl font-bold text-foreground">{categoryLabel}</h1>
            </div>
            {categoryDesc && <p className="text-xs text-muted-foreground">{categoryDesc}</p>}
          </div>
        </motion.div>

        {/* Services grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-4xl mb-3">{meta.icon}</p>
            <p className="font-medium">{t('customer.services.noServices')}</p>
            <p className="text-sm mt-1">{t('customer.services.noServicesDesc')}</p>
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
                className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col gap-2 hover:shadow-md transition-shadow"
              >
                <div className="text-3xl">{getServiceIcon(svc.name)}</div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-sm leading-tight">{svc.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{svc.description}</p>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <span className="text-lg font-bold text-foreground">₹{svc.price}</span>
                    {svc.duration > 0 && (
                      <span className="text-xs text-muted-foreground ml-1 flex items-center gap-0.5 inline-flex">
                        <Clock className="w-3 h-3" />{svc.duration}h
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/customer/book/${svc._id}`)}
                    className="btn-brand text-xs py-2 px-4"
                    disabled={svc.availability?.available === false}
                  >
                    {svc.availability?.available === false
                      ? t('customer.services.unavailable', 'Unavailable')
                      : t('customer.services.book', 'Book')}
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
