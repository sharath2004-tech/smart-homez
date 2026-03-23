import { servicesAPI } from "@/lib/api";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BookServicePage from "./BookServicePage"; // Fallback for other services
import ACServicingPage from "./services/ACServicingPage";
import CleaningServicePage from "./services/CleaningServicePage";
import MaidServicePage from "./services/MaidServicePage";
import MiniCleanServicePage from "./services/MiniCleanServicePage";
import PlumbingServicePage from "./services/PlumbingServicePage";

const MINI_SERVICE_TYPES = new Set([
  'deep_cleaning_kitchen',
  'deep_cleaning_bathroom',
  'fixed_sofa_cleaning',
  'fixed_carpet_cleaning',
  'fixed_window_cleaning',
  'fixed_fan_cleaning',
  'fixed_balcony_cleaning',
  'fixed_fridge_cleaning',
  'fixed_microwave_cleaning',
  'fixed_oven_cleaning',
  'fixed_stove_cleaning',
  'fixed_chimney_cleaning',
  'fixed_kitchen_platform_cleaning',
  'fixed_sink_cleaning',
  'kitchen_appliances_package',
  'fixed_washbasin_cleaning',
  'fixed_window_mesh_cleaning',
  'fixed_washroom_basic',
  'fixed_washroom_deep',
  'fixed_dining_cleaning',
  'fixed_cabinet_cleaning',
  'fixed_utility_cleaning',
  'fixed_cupboard_cleaning',
  'bedroom_package',
  'fixed_bed_cleaning',
  'fixed_mirror_cleaning',
  'fixed_ac_indoor_cleaning',
  'fixed_ac_outdoor_cleaning',
  'fixed_door_cleaning',
]);

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
        const serviceTypeValue = service.serviceType || '';
        const serviceCategory = service.serviceCategory || '';

        // Quote services → deep cleaning custom builder
        if (service.isQuoteService) {
          navigate('/customer/deep-cleaning/customize', { replace: true });
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
            serviceTypeValue === 'instant_hourly' ||
            serviceName.includes('instant') ||
            serviceName.includes('ad hoc')) {
          setServiceType('maid');
        }
        // Priority 2: Mini / spot-clean services (individual add-on services)
        else if (
          serviceTags.includes('mini-service') ||
          serviceTags.includes('spot-clean') ||
          MINI_SERVICE_TYPES.has(serviceTypeValue) ||
          ['spot_cleaning', 'kitchen_services', 'bathroom_services', 'furniture_services', 'hvac_services'].includes(serviceCategory)
        ) {
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
