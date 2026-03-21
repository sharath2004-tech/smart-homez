import AppLayout from '@/components/AppLayout';
import { ArrowRight, CheckCircle, XCircle, PhoneIcon, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function InstaMaidCapabilities() {
  const navigate = useNavigate();

  const dos = [
    'General dusting and sweeping',
    'Floor cleaning and mopping',
    'Kitchen counter and sink cleaning',
    'Bathroom basic cleaning',
    'Arranging and organizing items',
    'Trash removal',
    'Quick spot cleaning'
  ];

  const donts = [
    'Bathroom deep cleaning',
    'High ceiling or wall cleaning',
    'Window washing',
    'Heavy laundry work',
    'Ironing clothes',
    'Cooking',
    'Professional equipment cleaning (AC, refrigerator internals)'
  ];

  const faq = [
    {
      question: 'What is Insta Maid service?',
      answer: 'Insta Maid is an on-demand hourly maid service where you can book professional cleaners for 1-8 hours based on your immediate cleaning needs. Perfect for quick cleaning tasks and daily maintenance.'
    },
    {
      question: 'How long does each booking take?',
      answer: 'You can book from 1 hour to 8 hours in a single session. The duration depends on the size of your home and the tasks you need completed.'
    },
    {
      question: 'Can I book Insta Maid for deep cleaning?',
      answer: 'For complete deep cleaning of your entire home, we recommend our Deep Cleaning service which includes kitchen, bathrooms, windows, and all surfaces with a longer duration.'
    },
    {
      question: 'What if I need bathroom deep cleaning?',
      answer: 'We have a dedicated Deep Washroom Cleaning service that specializes in bathroom deep clean. Insta Maid service includes only basic bathroom cleaning.'
    },
    {
      question: 'Can Insta Maid workers clean high ceilings or fans?',
      answer: 'No, Insta Maid service excludes high ceiling areas. For ceiling and fan cleaning, please book our specialized Spot Clean services or Deep Cleaning package.'
    },
    {
      question: 'Is laundry included?',
      answer: 'No, Insta Maid does not include heavy laundry work or ironing. For laundry services, please contact our support team for customized solutions.'
    }
  ];

  return (
    <AppLayout userType="customer" userName="">
      <div className="space-y-8 pb-20 md:pb-0">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200 rounded-2xl p-8 md:p-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            🧹 Insta Maid Service
          </h1>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Professional on-demand hourly cleaning for your home. Quick, reliable, and affordable.
          </p>
          <button
            onClick={() => navigate('/services')}
            className="btn-brand inline-flex items-center gap-2"
          >
            Book Now <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* What's Included */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-bold text-green-700">What's Included ✅</h2>
            </div>
            <div className="space-y-3">
              {dos.map((item, index) => (
                <div key={index} className="flex gap-3 items-start p-3 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* What's NOT Included */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-bold text-red-700">Not Included ❌</h2>
            </div>
            <div className="space-y-3">
              {donts.map((item, index) => (
                <div key={index} className="flex gap-3 items-start p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-red-600 font-bold mt-0.5">✗</span>
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Service Alternatives */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">🎯 Looking for Something Else?</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card-elevated p-4 border-l-4 border-green-500">
              <h3 className="font-semibold text-foreground mb-2">🏠 Deep Cleaning</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Complete deep clean of your entire home including kitchen, bathrooms, windows, and more.
              </p>
              <button
                onClick={() => navigate('/services?type=deep_cleaning')}
                className="text-sm text-primary hover:underline font-medium"
              >
                Explore Deep Cleaning →
              </button>
            </div>
            <div className="card-elevated p-4 border-l-4 border-purple-500">
              <h3 className="font-semibold text-foreground mb-2">🔄 Regular Maid Service</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Recurring daily, weekly or monthly cleaning with a dedicated worker and special discounts.
              </p>
              <button
                onClick={() => navigate('/services?type=subscription')}
                className="text-sm text-primary hover:underline font-medium"
              >
                View Plans →
              </button>
            </div>
            <div className="card-elevated p-4 border-l-4 border-cyan-500">
              <h3 className="font-semibold text-foreground mb-2">🧽 Spot Cleaning</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Individual room or area specific cleaning - Kitchen, Bathroom, Sofa, Carpet, Windows, and more.
              </p>
              <button
                onClick={() => navigate('/services?type=spot-clean')}
                className="text-sm text-primary hover:underline font-medium"
              >
                Browse Services →
              </button>
            </div>
            <div className="card-elevated p-4 border-l-4 border-blue-500">
              <h3 className="font-semibold text-foreground mb-2">💬 Custom Request</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Need something special? Contact our team to discuss custom service packages.
              </p>
              <button
                onClick={() => navigate('/contact')}
                className="text-sm text-primary hover:underline font-medium"
              >
                Get in Touch →
              </button>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <HelpCircle className="w-6 h-6" />
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faq.map((item, index) => (
              <details key={index} className="group card-elevated">
                <summary className="flex cursor-pointer items-center justify-between p-4 font-medium text-foreground hover:bg-muted transition-colors">
                  <span>{item.question}</span>
                  <span className="transition group-open:rotate-180">
                    <svg
                      className="h-5 w-5 text-muted-foreground"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </summary>
                <div className="border-t border-border px-4 py-4 text-muted-foreground text-sm">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-8 md:p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to book Insta Maid?</h2>
          <p className="text-lg opacity-90 mb-6 max-w-2xl mx-auto">
            Professional cleaning services at your fingertips. Quick booking, transparent pricing, and trusted workers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/services')}
              className="btn-brand bg-white text-blue-600 hover:bg-gray-50"
            >
              Book Insta Maid Now
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="px-6 py-3 border border-white rounded-lg font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <PhoneIcon className="w-4 h-4" />
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
