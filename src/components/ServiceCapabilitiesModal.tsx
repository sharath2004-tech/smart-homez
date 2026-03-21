import { X } from 'lucide-react';

interface ServiceCapabilitiesModalProps {
  serviceName: string;
  dos: string[];
  donts: string[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ServiceCapabilitiesModal({
  serviceName,
  dos,
  donts,
  isOpen,
  onClose
}: ServiceCapabilitiesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 md:p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">
            {serviceName} — What We Do & Don't Do
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Dos Section */}
          {dos && dos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">✅</span>
                <h3 className="text-lg font-bold text-green-700">This Service INCLUDES</h3>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                {dos.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="text-green-600 font-bold mt-0.5">•</span>
                    <p className="text-sm text-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Don'ts Section */}
          {donts && donts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">❌</span>
                <h3 className="text-lg font-bold text-red-700">This Service EXCLUDES</h3>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                {donts.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="text-red-600 font-bold mt-0.5">•</span>
                    <p className="text-sm text-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>💡 Tip:</strong> If you need services not listed above, feel free to contact our support team to discuss custom service packages.
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full btn-brand"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
