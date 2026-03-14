import { servicesAPI } from "@/lib/api";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BookServicePage from "./BookServicePage"; // Fallback for other services
import ACServicingPage from "./services/ACServicingPage";
import CleaningServicePage from "./services/CleaningServicePage";
import MaidServicePage from "./services/MaidServicePage";
import MiniCleanServicePage from "./services/MiniCleanServicePage";
import PlumbingServicePage from "./services/PlumbingServicePage";

const ServiceRouter = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServiceType = async () => {
      try {
        const response = await servicesAPI.getById(id!);
        const service = response.service;
        const serviceName = service.name.toLowerCase();
        const serviceTags = service.tags || [];

        // Quote services → deep cleaning cart page
        if (service.isQuoteService) {
          navigate('/customer/deep-cleaning', { replace: true });
          return;
        }

        // Subscription services → subscription booking page
        if (service.subscriptionOptions?.enabled) {
          navigate(`/customer/subscribe/${id}`, { replace: true });
          return;
        }

        // Priority 1: Check for maid services (time-based)
        if (serviceName.includes('maid') ||
            serviceName.includes('insta maid') ||
            serviceTags.includes('maid') ||
            serviceTags.includes('hourly') ||
            serviceName.includes('instant') ||
            serviceName.includes('ad hoc')) {
          setServiceType('maid');
        }
        // Priority 2: Mini / spot-clean services (individual add-on services)
        else if (serviceTags.includes('mini-service') || serviceTags.includes('spot-clean')) {
          setServiceType('mini');
        }
        // Priority 3: Check for other cleaning services
        else if (serviceName.includes('clean')) {
          setServiceType('cleaning');
        } else if (serviceName.includes('ac') || serviceName.includes('air condition')) {
          setServiceType('ac');
        } else if (serviceName.includes('plumb')) {
          setServiceType('plumbing');
        } else if (serviceName.includes('electric')) {
          setServiceType('electrical');
        } else if (serviceName.includes('paint')) {
          setServiceType('painting');
        } else if (serviceName.includes('pest')) {
          setServiceType('pest');
        } else {
          // Fallback to generic booking page
          setServiceType('generic');
        }
      } catch (error) {
        console.error('Error fetching service:', error);
        navigate('/customer/services');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchServiceType();
    }
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading service...</p>
        </div>
      </div>
    );
  }

  // Route to the appropriate specialized page
  switch (serviceType) {
    case 'maid':
      return <MaidServicePage />;
    case 'mini':
      return <MiniCleanServicePage />;
    case 'cleaning':
      return <CleaningServicePage />;
    case 'ac':
      return <ACServicingPage />;
    case 'plumbing':
      return <PlumbingServicePage />;
    case 'electrical':
    case 'painting':
    case 'pest':
    case 'generic':
    default:
      return <BookServicePage />;
  }
};

export default ServiceRouter;
