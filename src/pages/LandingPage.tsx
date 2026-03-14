import { LanguageSelector } from "@/components/LanguageSelector";
import { publicAPI } from "@/lib/api";
import { ArrowRight, CheckCircle, ChevronRight, Clock, Home, MapPin, Shield, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const LandingPage = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalWorkers: 0,
    servicesDone: 0,
    fulfillmentRate: 95
  });
  const [loading, setLoading] = useState(true);
  // Track whether we got real data from the API
  const [statsLoaded, setStatsLoaded] = useState(false);

  const services = [
    { icon: "🧹", nameKey: "landing.services.instaMaid", descKey: "landing.services.instaMaidDesc", tagKey: "landing.services.popular", color: "bg-accent" },
    { icon: "✨", nameKey: "landing.services.deepCleaning", descKey: "landing.services.deepCleaningDesc", tagKey: "landing.services.bestValue", color: "bg-secondary" },
    { icon: "🍳", nameKey: "landing.services.kitchenCleaning", descKey: "landing.services.kitchenCleaningDesc", tagKey: "", color: "bg-accent" },
    { icon: "🚿", nameKey: "landing.services.bathroomCleaning", descKey: "landing.services.bathroomCleaningDesc", tagKey: "", color: "bg-secondary" },
    { icon: "🪟", nameKey: "landing.services.windowCleaning", descKey: "landing.services.windowCleaningDesc", tagKey: "", color: "bg-accent" },
    { icon: "🛋️", nameKey: "landing.services.sofaCleaning", descKey: "landing.services.sofaCleaningDesc", tagKey: "", color: "bg-secondary" },
  ];

  const testimonials = [
    { nameKey: "landing.testimonials.name1", rating: 5, textKey: "landing.testimonials.review1", cityKey: "landing.testimonials.city1", avatar: "PS" },
    { nameKey: "landing.testimonials.name2", rating: 5, textKey: "landing.testimonials.review2", cityKey: "landing.testimonials.city2", avatar: "RG" },
    { nameKey: "landing.testimonials.name3", rating: 4, textKey: "landing.testimonials.review3", cityKey: "landing.testimonials.city3", avatar: "AM" },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await publicAPI.getStats();
        if (response.success) {
          setStats(response.stats);
          setStatsLoaded(true);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        // Keep default values on error
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K+';
    }
    return num.toString() + '+';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-heading text-foreground">Healthy Homez</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t('landing.nav.services')}</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t('landing.nav.howItWorks')}</a>
            <a href="#reviews" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t('landing.nav.reviews')}</a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <Link to="/login" className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-4 py-2">
              {t('landing.nav.login')}
            </Link>
            <Link to="/register" className="btn-brand text-sm py-2.5 px-5">
              {t('landing.nav.getStarted')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 right-20 w-80 h-80 rounded-full bg-primary-foreground blur-3xl" />
          <div className="absolute bottom-10 left-20 w-60 h-60 rounded-full bg-primary-foreground blur-2xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="max-w-2xl">
            <div className="badge-primary inline-flex mb-6 animate-fade-in" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "white" }}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('landing.hero.badge')}</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold font-heading text-primary-foreground leading-tight mb-6 animate-fade-in">
              {t('landing.hero.title').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h1>
            <p className="text-xl text-primary-foreground/70 leading-relaxed mb-8 animate-fade-in">
              {t('landing.hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-12 animate-fade-in">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-primary-foreground text-primary font-bold py-4 px-8 rounded-xl hover:opacity-90 transition-all hover:-translate-y-0.5">
                {t('landing.hero.bookService')} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/login?type=worker" className="inline-flex items-center justify-center gap-2 border-2 border-primary-foreground/30 text-primary-foreground font-semibold py-4 px-8 rounded-xl hover:bg-primary-foreground/10 transition-all">
                {t('landing.hero.becomeWorker')}
              </Link>
            </div>
            {/* Trust indicators */}
            <div className="flex flex-wrap gap-6 animate-fade-in">
              {[
                { icon: CheckCircle, textKey: "landing.hero.verifiedWorkers" },
                { icon: Shield, textKey: "landing.hero.safeSure" },
                { icon: Clock, textKey: "landing.hero.realTimeTracking" },
              ].map((item) => (
                <div key={item.textKey} className="flex items-center gap-2 text-primary-foreground/70 text-sm">
                  <item.icon className="w-4 h-4 text-primary-foreground" />
                  <span>{t(item.textKey)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Stats bar */}
        <div className="relative max-w-6xl mx-auto px-6 mt-16">
          <div className="grid grid-cols-3 gap-4 md:gap-8">
            {[
              { value: loading ? "..." : statsLoaded ? formatNumber(stats.totalCustomers) : "500+", labelKey: "landing.stats.happyCustomers" },
              { value: loading ? "..." : statsLoaded ? formatNumber(stats.totalWorkers) : "50+", labelKey: "landing.stats.activeWorkers" },
              { value: loading ? "..." : `${stats.fulfillmentRate}%+`, labelKey: "landing.stats.fulfillmentRate" },
            ].map((stat) => (
              <div key={stat.labelKey} className="text-center p-4 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
                <div className="text-2xl md:text-3xl font-bold font-heading text-primary-foreground">{stat.value}</div>
                <div className="text-xs text-primary-foreground/60 mt-1">{t(stat.labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="section-title mb-3">{t('landing.services.title')}</h2>
          <p className="text-muted-foreground max-w-md mx-auto">{t('landing.services.subtitle')}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {services.map((service) => (
            <Link
              to="/register"
              key={service.nameKey}
              className="card-elevated-hover p-5 group cursor-pointer"
            >
              <div className={`w-12 h-12 ${service.color} rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                {service.icon}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold font-heading text-foreground text-sm mb-1">{t(service.nameKey)}</h3>
                  <p className="text-xs text-muted-foreground">{t(service.descKey)}</p>
                </div>
                {service.tagKey && <span className="badge-primary text-xs shrink-0">{t(service.tagKey)}</span>}
              </div>
              <div className="flex items-center gap-1 mt-3 text-primary text-xs font-medium">
                {t('landing.services.bookNow')} <ChevronRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>

        {/* Deep Cleaning Commercial Quote Banner */}
        <Link
          to="/deep-cleaning-quote"
          className="mt-6 flex items-center gap-4 p-5 rounded-2xl border-2 border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all group"
        >
          <div className="w-14 h-14 bg-green-200 rounded-2xl flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
            ✨
          </div>
          <div className="flex-1">
            <h3 className="font-bold font-heading text-green-900 text-base">Deep Cleaning — Commercial &amp; Residential</h3>
            <p className="text-sm text-green-700 mt-0.5">Villas · Restaurants · Offices · Bungalows · Corporate Spaces</p>
            <p className="text-xs text-green-600 mt-1">Custom pricing based on your property — our team will call you with a quote.</p>
          </div>
          <div className="shrink-0 hidden sm:flex items-center gap-2 bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl group-hover:bg-green-800 transition-colors">
            Get Free Quote <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-muted">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="section-title mb-3">{t('landing.howItWorks.title')}</h2>
            <p className="text-muted-foreground max-w-md mx-auto">{t('landing.howItWorks.subtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", icon: MapPin, titleKey: "landing.howItWorks.step1Title", descKey: "landing.howItWorks.step1Desc" },
              { step: "02", icon: CheckCircle, titleKey: "landing.howItWorks.step2Title", descKey: "landing.howItWorks.step2Desc" },
              { step: "03", icon: Star, titleKey: "landing.howItWorks.step3Title", descKey: "landing.howItWorks.step3Desc" },
            ].map((item) => (
              <div key={item.step} className="card-elevated p-7 relative">
                <div className="absolute top-5 right-5 text-4xl font-bold font-heading text-muted/50">{item.step}</div>
                <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center mb-5">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold font-heading text-foreground mb-2">{t(item.titleKey)}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{t(item.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="reviews" className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="section-title mb-3">{t('landing.testimonials.title')}</h2>
          <p className="text-muted-foreground">{t('landing.testimonials.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <div key={testimonial.nameKey} className="card-elevated p-6">
              <div className="flex gap-1 mb-3">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                ))}
              </div>
              <p className="text-foreground text-sm leading-relaxed mb-4">"{t(testimonial.textKey)}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-light rounded-full flex items-center justify-center text-primary text-xs font-bold">{testimonial.avatar}</div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{t(testimonial.nameKey)}</div>
                  <div className="text-xs text-muted-foreground">{t(testimonial.cityKey)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20" style={{ background: "var(--gradient-brand)" }}>
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold font-heading text-primary-foreground mb-4">{t('landing.cta.title')}</h2>
          <p className="text-primary-foreground/70 mb-8 text-lg">
            {loading || !statsLoaded ? t('landing.cta.subtitleFallback') : t('landing.cta.subtitle').replace('{{count}}', formatNumber(stats.totalCustomers))}
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-primary-foreground text-primary font-bold py-4 px-10 rounded-xl hover:opacity-90 transition-all hover:-translate-y-0.5">
            {t('landing.cta.button')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold font-heading text-foreground">Healthy Homez</span>
          </div>
          <p className="text-sm text-muted-foreground">{t('landing.footer.copyright')}</p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">{t('landing.footer.privacy')}</a>
            <a href="#" className="hover:text-foreground transition-colors">{t('landing.footer.terms')}</a>
            <a href="#" className="hover:text-foreground transition-colors">{t('landing.footer.support')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
