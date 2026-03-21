import { DollarSign, MapPin, Phone, User } from "lucide-react";
import React, { forwardRef } from "react";

interface CartItem {
  name: string;
  qty?: number;
  totalPrice: number;
}

interface Worker {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  profileImage?: string;
}

interface Location {
  _id: string;
  address?: string;
  apartment?: string;
  building?: string;
  area?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface Service {
  _id: string;
  name: string;
  category: string;
}

interface BookingPrintData {
  _id: string;
  bookingId?: string;
  service?: Service | null;
  bookingType?: string;
  cartItems?: CartItem[];
  worker?: Worker;
  customer: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  location: Location;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  actualStartTime?: string;
  actualEndTime?: string;
  overtimeCharges?: number;
  paymentStatus?: string;
}

interface BookingOrderPrintProps {
  booking: BookingPrintData;
  companyName?: string;
  companyPhone?: string;
}

const BookingOrderPrint = forwardRef<HTMLDivElement, BookingOrderPrintProps>(
  ({ booking, companyName = "Healthy Homez", companyPhone = "+91 84658 93790" }, ref) => {
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();
    const formatTime = (timeStr: string) => {
      try {
        const [hours, minutes] = timeStr.split(":");
        return `${hours}:${minutes} ${parseInt(hours) >= 12 ? "PM" : "AM"}`;
      } catch {
        return timeStr;
      }
    };

    const getServiceName = () => {
      if (booking.bookingType === "deep-cleaning-cart") {
        return "Deep Cleaning Service";
      }
      return booking.service?.name || "Service";
    };

    const calculateItemsTotal = () => {
      return booking.cartItems?.reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0;
    };

    const itemsTotal = calculateItemsTotal();
    const overtimeCharges = booking.overtimeCharges || 0;
    const baseTotal = itemsTotal + overtimeCharges;

    return (
      <div
        ref={ref}
        className="max-w-2xl mx-auto p-8 bg-white text-foreground"
        style={{
          fontFamily: "'Segoe UI', 'Helvetica', sans-serif",
          color: "#1a1a1a",
          lineHeight: "1.6"
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px", borderBottom: "2px solid #e0e0e0", paddingBottom: "16px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "700", margin: "0 0 8px 0" }}>
            {companyName}
          </h1>
          <p style={{ fontSize: "14px", color: "#666", margin: "0" }}>
            Service Order Receipt
          </p>
        </div>

        {/* Order Info Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
          {/* Left Column */}
          <div>
            <div style={{ marginBottom: "24px" }}>
              <p style={{ fontSize: "12px", color: "#999", margin: "0 0 4px 0", textTransform: "uppercase", fontWeight: "600" }}>
                Order Number
              </p>
              <p style={{ fontSize: "16px", fontWeight: "700", margin: "0" }}>
                #{booking.bookingId || booking._id.slice(-8).toUpperCase()}
              </p>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <p style={{ fontSize: "12px", color: "#999", margin: "0 0 4px 0", textTransform: "uppercase", fontWeight: "600" }}>
                Order Date
              </p>
              <p style={{ fontSize: "14px", margin: "0" }}>
                {formatDate(booking.bookingDate)}
              </p>
            </div>

            <div>
              <p style={{ fontSize: "12px", color: "#999", margin: "0 0 4px 0", textTransform: "uppercase", fontWeight: "600" }}>
                Order Status
              </p>
              <p style={{
                fontSize: "14px",
                margin: "0",
                padding: "4px 8px",
                display: "inline-block",
                backgroundColor: booking.status === "completed" ? "#d4edda" : "#fff3cd",
                color: booking.status === "completed" ? "#155724" : "#856404",
                borderRadius: "4px",
                fontWeight: "600"
              }}>
                {booking.status?.toUpperCase() || "PENDING"}
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div>
            <div style={{ marginBottom: "24px" }}>
              <p style={{ fontSize: "12px", color: "#999", margin: "0 0 4px 0", textTransform: "uppercase", fontWeight: "600" }}>
                Service Time
              </p>
              <p style={{ fontSize: "14px", margin: "0" }}>
                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
              </p>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <p style={{ fontSize: "12px", color: "#999", margin: "0 0 4px 0", textTransform: "uppercase", fontWeight: "600" }}>
                Service Type
              </p>
              <p style={{ fontSize: "14px", margin: "0" }}>
                {getServiceName()}
              </p>
            </div>

            <div>
              <p style={{ fontSize: "12px", color: "#999", margin: "0 0 4px 0", textTransform: "uppercase", fontWeight: "600" }}>
                Payment Status
              </p>
              <p style={{ fontSize: "14px", margin: "0", fontWeight: "600" }}>
                {booking.paymentStatus?.toUpperCase() || "PENDING"}
              </p>
            </div>
          </div>
        </div>

        {/* Customer & Location Info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px", padding: "16px", backgroundColor: "#f9f9f9", borderRadius: "8px" }}>
          <div>
            <h3 style={{ fontSize: "12px", fontWeight: "700", margin: "0 0 12px 0", color: "#666", textTransform: "uppercase" }}>
              Customer Information
            </h3>
            <p style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 4px 0" }}>
              {booking.customer.name}
            </p>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 4px 0", wordBreak: "break-word" }}>
              Email: {booking.customer.email}
            </p>
            {booking.customer.phone && (
              <p style={{ fontSize: "13px", color: "#666", margin: "0" }}>
                Phone: {booking.customer.phone}
              </p>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: "12px", fontWeight: "700", margin: "0 0 12px 0", color: "#666", textTransform: "uppercase" }}>
              Service Location
            </h3>
            <p style={{ fontSize: "14px", margin: "0 0 4px 0" }}>
              {booking.location.address || booking.location.apartment || "Address not provided"}
            </p>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 4px 0" }}>
              {booking.location.area && `${booking.location.area}, `}
              {booking.location.city}
              {booking.location.state ? ` - ${booking.location.state}` : ""}
            </p>
            {booking.location.zipCode && (
              <p style={{ fontSize: "13px", color: "#666", margin: "0" }}>
                PIN: {booking.location.zipCode}
              </p>
            )}
          </div>
        </div>

        {/* Worker Info (if assigned) */}
        {booking.worker && (
          <div style={{ marginBottom: "32px", padding: "16px", backgroundColor: "#f0f7ff", borderRadius: "8px", border: "1px solid #e0f0ff" }}>
            <h3 style={{ fontSize: "12px", fontWeight: "700", margin: "0 0 12px 0", color: "#0066cc", textTransform: "uppercase" }}>
              Assigned Professional
            </h3>
            <p style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 4px 0" }}>
              {booking.worker.name}
            </p>
            {booking.worker.phone && (
              <p style={{ fontSize: "13px", color: "#666", margin: "0 0 4px 0" }}>
                Phone: {booking.worker.phone}
              </p>
            )}
            {booking.worker.email && (
              <p style={{ fontSize: "13px", color: "#666", margin: "0" }}>
                Email: {booking.worker.email}
              </p>
            )}
          </div>
        )}

        {/* Items Breakdown */}
        {booking.cartItems && booking.cartItems.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: "700", margin: "0 0 16px 0", color: "#666", textTransform: "uppercase" }}>
              Service Items
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "8px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#666" }}>
                    Item
                  </th>
                  <th style={{ padding: "8px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#666" }}>
                    Qty
                  </th>
                  <th style={{ padding: "8px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#666" }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {booking.cartItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px", fontSize: "13px" }}>
                      {item.name}
                    </td>
                    <td style={{ padding: "8px", textAlign: "center", fontSize: "13px" }}>
                      {item.qty || 1}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", fontSize: "13px", fontWeight: "600" }}>
                      ₹{item.totalPrice.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Price Breakdown */}
        <div style={{ marginBottom: "32px", padding: "16px", backgroundColor: "#fafafa", borderRadius: "8px", border: "1px solid #e0e0e0" }}>
          <h3 style={{ fontSize: "12px", fontWeight: "700", margin: "0 0 16px 0", color: "#666", textTransform: "uppercase" }}>
            Billing Summary
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", fontSize: "14px" }}>
            {booking.cartItems && booking.cartItems.length > 0 && (
              <>
                <span>Service Items Total:</span>
                <span>₹{itemsTotal.toLocaleString()}</span>
              </>
            )}

            {overtimeCharges > 0 && (
              <>
                <span>Overtime Charges:</span>
                <span>₹{overtimeCharges.toLocaleString()}</span>
              </>
            )}

            <div style={{ gridColumn: "1 / -1", height: "1px", backgroundColor: "#ddd", margin: "8px 0" }}></div>

            <span style={{ fontWeight: "700", fontSize: "16px" }}>
              Total Amount:
            </span>
            <span style={{ fontWeight: "700", fontSize: "16px", color: "#2d5f2e" }}>
              ₹{booking.totalAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Terms & Footer */}
        <div style={{ borderTop: "1px solid #ddd", paddingTop: "24px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#999", margin: "0 0 16px 0" }}>
            Thank you for choosing {companyName}
          </p>

          <div style={{ fontSize: "12px", color: "#666", textAlign: "center", marginBottom: "16px" }}>
            <p style={{ margin: "0 0 4px 0" }}>
              For any queries, contact:
            </p>
            <p style={{ margin: "0", fontWeight: "600" }}>
              {companyPhone}
            </p>
          </div>

          <p style={{ fontSize: "11px", color: "#999", margin: "0", fontStyle: "italic" }}>
            This is a computer-generated document and does not require a signature.
          </p>
        </div>
      </div>
    );
  }
);

BookingOrderPrint.displayName = "BookingOrderPrint";

export default BookingOrderPrint;
