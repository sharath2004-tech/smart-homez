import AppLayout from "@/components/AppLayout";
import { helpAPI } from "@/lib/api";
import { CheckCircle, ChevronDown, ChevronUp, HelpCircle, Phone, Send } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface FaqItem {
  question: string;
  answer: string;
}

const useFaqs = (t: (key: string) => string): FaqItem[] => [
  { question: t('customer.help.faq1q'), answer: t('customer.help.faq1a') },
  { question: t('customer.help.faq2q'), answer: t('customer.help.faq2a') },
  { question: t('customer.help.faq3q'), answer: t('customer.help.faq3a') },
  { question: t('customer.help.faq4q'), answer: t('customer.help.faq4a') },
  { question: t('customer.help.faq5q'), answer: t('customer.help.faq5a') },
  { question: t('customer.help.faq6q'), answer: t('customer.help.faq6a') },
  { question: t('customer.help.faq7q'), answer: t('customer.help.faq7a') },
];

interface HelpPageProps {
  userType?: "customer" | "worker";
}

const HelpPage = ({ userType = "customer" }: HelpPageProps) => {
  const { t } = useTranslation();
  const faqs = useFaqs(t);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      await helpAPI.submitMessage(subject.trim() || "General Enquiry", message.trim());
      setSubmitted(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError((err as Error).message || "Failed to send message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout userType={userType}>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 animate-fade-in pb-20 md:pb-0">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-primary" />
            {t('customer.help.title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('customer.help.subtitle')}
          </p>
        </div>

        {/* Contact card */}
        <div className="card-elevated p-4 sm:p-5 md:p-6 flex items-center gap-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0">
            <Phone className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{t('customer.help.customerSupport')}</p>
            <a
              href="tel:+919999999999"
              className="text-xl font-bold text-foreground hover:text-primary transition-colors"
            >
              +91 99999 99999
            </a>
            <p className="text-xs text-muted-foreground mt-0.5">{t('customer.help.supportHours')}</p>
          </div>
        </div>

        {/* FAQ section */}
        <div>
          <h2 className="text-base font-bold font-heading text-foreground mb-3">
            {t('customer.help.faq')}
          </h2>
          <div className="space-y-2">
            {faqs.map((item, index) => (
              <div
                key={index}
                className="card-elevated overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggle(index)}
                  className="w-full flex items-center justify-between p-4 text-left gap-3"
                >
                  <span className="font-medium text-sm text-foreground">
                    {item.question}
                  </span>
                  {openIndex === index ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {openIndex === index && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Contact form */}
        <div>
          <h2 className="text-base font-bold font-heading text-foreground mb-3">
            {t('customer.help.sendMessage')}
          </h2>

          {submitted ? (
            <div className="card-elevated p-4 sm:p-5 md:p-6 flex flex-col items-center gap-3 text-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <p className="font-semibold text-foreground">{t('customer.help.messageSent')}</p>
              <p className="text-sm text-muted-foreground">
                {t('customer.help.messageSentDesc')}
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-sm text-primary underline mt-1"
              >
                {t('customer.help.sendAnother')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card-elevated p-4 sm:p-5 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('customer.help.subject')} <span className="text-muted-foreground font-normal">{t('customer.help.subjectOptional')}</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('customer.help.subjectPlaceholder')}
                  maxLength={200}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('customer.help.message')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('customer.help.messagePlaceholder')}
                  rows={5}
                  maxLength={2000}
                  required
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-0.5 text-right">
                  {message.length}/2000
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="btn-brand w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                {submitting ? t('customer.help.sending') : t('customer.help.sendBtn')}
              </button>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default HelpPage;
