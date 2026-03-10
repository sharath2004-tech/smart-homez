import AppLayout from "@/components/AppLayout";
import { helpAPI } from "@/lib/api";
import { CheckCircle, ChevronDown, ChevronUp, HelpCircle, Phone, Send } from "lucide-react";
import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: "How do I book a service?",
    answer:
      "Go to the Services tab, choose the service you need, pick a date and time slot, confirm your address, and complete the booking. You'll receive a confirmation once a worker is assigned.",
  },
  {
    question: "Can I reschedule or cancel my booking?",
    answer:
      "Yes. Open your booking from the My Bookings tab and use the reschedule or cancel option before the worker starts. Cancellations made at least 2 hours before the appointment are free of charge.",
  },
  {
    question: "How do I pay for a service?",
    answer:
      "We accept UPI payments only. After the worker marks the job as complete, you'll receive a payment QR code. Scan it with any UPI app to complete the payment.",
  },
  {
    question: "What if the worker doesn't show up?",
    answer:
      "If your worker is more than 15 minutes late without notice, please contact our support number immediately. We'll arrange a replacement or issue a full refund.",
  },
  {
    question: "How are workers verified?",
    answer:
      "All workers go through ID verification, background checks, and a training assessment before they are allowed to take bookings on the platform.",
  },
  {
    question: "How do I raise a complaint about a completed service?",
    answer:
      "Call our support number within 24 hours of service completion. Provide your booking ID and describe the issue. Our team will review and respond within one business day.",
  },
  {
    question: "Is my personal information safe?",
    answer:
      "Yes. We only share your name and general address area with the assigned worker. Your phone number is never disclosed. All data is stored securely and never sold to third parties.",
  },
];

interface HelpPageProps {
  userType?: "customer" | "worker";
}

const HelpPage = ({ userType = "customer" }: HelpPageProps) => {
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
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-primary" />
            Help &amp; Support
          </h1>
          <p className="text-muted-foreground text-sm">
            Find answers to common questions or reach us directly.
          </p>
        </div>

        {/* Contact card */}
        <div className="card-elevated p-5 flex items-center gap-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0">
            <Phone className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Customer Support</p>
            <a
              href="tel:+919999999999"
              className="text-xl font-bold text-foreground hover:text-primary transition-colors"
            >
              +91 99999 99999
            </a>
            <p className="text-xs text-muted-foreground mt-0.5">Mon–Sat, 8 AM – 8 PM</p>
          </div>
        </div>

        {/* FAQ section */}
        <div>
          <h2 className="text-base font-bold font-heading text-foreground mb-3">
            Frequently Asked Questions
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
            Send Us a Message
          </h2>

          {submitted ? (
            <div className="card-elevated p-6 flex flex-col items-center gap-3 text-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <p className="font-semibold text-foreground">Message sent!</p>
              <p className="text-sm text-muted-foreground">
                We'll get back to you as soon as possible.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-sm text-primary underline mt-1"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card-elevated p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Subject <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Issue with my booking"
                  maxLength={200}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question…"
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
                {submitting ? "Sending…" : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default HelpPage;
