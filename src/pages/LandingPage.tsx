import { publicAPI } from "@/lib/api";
import { ArrowRight, CheckCircle, ChevronRight, Clock, Home, MapPin, Shield, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const services = [
  { icon: "🧹", name: "Insta Maid Service", desc: "On-demand, available in 15 min", tag: "Popular", color: "bg-accent" },
  { icon: "✨", name: "Deep Cleaning", desc: "Full-home professional cleaning", tag: "Best Value", color: "bg-secondary" },
  { icon: "🍳", name: "Kitchen Cleaning", desc: "Thorough kitchen sanitization", tag: "", color: "bg-accent" },
  { icon: "🚿", name: "Bathroom Cleaning", desc: "Deep clean & disinfection", tag: "", color: "bg-secondary" },
  { icon: "🪟", name: "Window Cleaning", desc: "Streak-free window cleaning", tag: "", color: "bg-accent" },
  { icon: "🛋️", name: "Sofa Cleaning", desc: "Professional upholstery care", tag: "", color: "bg-secondary" },
];

const testimonials = [
  { name: "Priya Sharma", rating: 5, text: "Amazing service! The maid arrived on time and cleaned everything spotlessly.", city: "Mumbai", avatar: "PS" },
  { name: "Rahul Gupta", rating: 5, text: "I've been using monthly subscription for 6 months now. Absolutely worth it!", city: "Delhi", avatar: "RG" },
  { name: "Anita Mehta", rating: 4, text: "Very professional workers and transparent pricing. Highly recommended.", city: "Bengaluru", avatar: "AM" },
];

const LandingPage = () => {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalWorkers: 0,
    servicesDone: 0,
    fulfillmentRate: 95
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await publicAPI.getStats();
        if (response.success) {
          setStats(response.stats);
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
            <a href="#services" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Services</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How it works</a>
            <a href="#reviews" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Reviews</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-4 py-2">
              Login
            </Link>
            <Link to="/register" className="btn-brand text-sm py-2.5 px-5">
              Get Started
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
              <span>On-demand home services in 15 mins</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold font-heading text-primary-foreground leading-tight mb-6 animate-fade-in">
              Your home,<br />professionally clean.
            </h1>
            <p className="text-xl text-primary-foreground/70 leading-relaxed mb-8 animate-fade-in">
              Book trusted maids and home cleaning professionals. Transparent pricing, verified workers, real-time tracking.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-12 animate-fade-in">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-primary-foreground text-primary font-bold py-4 px-8 rounded-xl hover:opacity-90 transition-all hover:-translate-y-0.5">
                Book a Service <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/login?type=worker" className="inline-flex items-center justify-center gap-2 border-2 border-primary-foreground/30 text-primary-foreground font-semibold py-4 px-8 rounded-xl hover:bg-primary-foreground/10 transition-all">
                Become a Worker
              </Link>
            </div>
            {/* Trust indicators */}
            <div className="flex flex-wrap gap-6 animate-fade-in">
              {[
                { icon: CheckCircle, text: "Verified workers" },
                { icon: Shield, text: "100% safe & secure" },
                { icon: Clock, text: "Real-time tracking" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-primary-foreground/70 text-sm">
                  <item.icon className="w-4 h-4 text-primary-foreground" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Stats bar */}
        <div className="relative max-w-6xl mx-auto px-6 mt-16">
          <div className="grid grid-cols-3 gap-4 md:gap-8">
            {[
              { value: loading ? "..." : formatNumber(stats.totalCustomers), label: "Happy Customers" },
              { value: loading ? "..." : formatNumber(stats.totalWorkers), label: "Active Workers" },
              { value: loading ? "..." : `${stats.fulfillmentRate}%+`, label: "Fulfillment Rate" },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
                <div className="text-2xl md:text-3xl font-bold font-heading text-primary-foreground">{stat.value}</div>
                <div className="text-xs text-primary-foreground/60 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="section-title mb-3">Our Services</h2>
          <p className="text-muted-foreground max-w-md mx-auto">From quick cleaning to deep home maintenance, we've got everything covered.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {services.map((service) => (
            <Link
              to="/register"
              key={service.name}
              className="card-elevated-hover p-5 group cursor-pointer"
            >
              <div className={`w-12 h-12 ${service.color} rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                {service.icon}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold font-heading text-foreground text-sm mb-1">{service.name}</h3>
                  <p className="text-xs text-muted-foreground">{service.desc}</p>
                </div>
                {service.tag && <span className="badge-primary text-xs shrink-0">{service.tag}</span>}
              </div>
              <div className="flex items-center gap-1 mt-3 text-primary text-xs font-medium">
                Book now <ChevronRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-muted">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="section-title mb-3">How It Works</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Getting help for your home is as easy as 1-2-3.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", icon: MapPin, title: "Choose your service", desc: "Browse from our range of home cleaning and maintenance services. Select type, time, and preferences." },
              { step: "02", icon: CheckCircle, title: "Get matched", desc: "Our smart system assigns the nearest available verified worker based on your preferences." },
              { step: "03", icon: Star, title: "Track & review", desc: "Track your worker in real-time, verify with QR code, and pay after the service is done." },
            ].map((item) => (
              <div key={item.step} className="card-elevated p-7 relative">
                <div className="absolute top-5 right-5 text-4xl font-bold font-heading text-muted/50">{item.step}</div>
                <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center mb-5">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold font-heading text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="reviews" className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="section-title mb-3">What Customers Say</h2>
          <p className="text-muted-foreground">Thousands of happy homes trust Healthy Homez.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="card-elevated p-6">
              <div className="flex gap-1 mb-3">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                ))}
              </div>
              <p className="text-foreground text-sm leading-relaxed mb-4">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-light rounded-full flex items-center justify-center text-primary text-xs font-bold">{t.avatar}</div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20" style={{ background: "var(--gradient-brand)" }}>
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold font-heading text-primary-foreground mb-4">Ready for a cleaner home?</h2>
          <p className="text-primary-foreground/70 mb-8 text-lg">
            Join {loading ? "thousands" : formatNumber(stats.totalCustomers)} of customers who trust Healthy Homez every day.
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-primary-foreground text-primary font-bold py-4 px-10 rounded-xl hover:opacity-90 transition-all hover:-translate-y-0.5">
            Get Started for Free <ArrowRight className="w-4 h-4" />
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
          <p className="text-sm text-muted-foreground">© 2026 Healthy Homez. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
