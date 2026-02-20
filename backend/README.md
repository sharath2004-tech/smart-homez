# Pure App Weave Backend

Backend API server for Pure App Weave application built with Node.js, Express, and MongoDB Atlas.

## Features

- RESTful API architecture
- MongoDB Atlas database integration
- JWT-based authentication
- Role-based access control (Customer, Worker, Admin)
- Comprehensive booking system
- Payment processing
- User management

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Validation**: express-validator

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB Atlas account

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   
   Create a `.env` file in the backend directory:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/pure-app-weave?retryWrites=true&w=majority
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   CLIENT_URL=http://localhost:5173
   ```

   Replace `<username>` and `<password>` with your MongoDB Atlas credentials.

3. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (Protected)

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user (Admin only)
- `GET /api/users/workers/available` - Get available workers

### Services
- `GET /api/services` - Get all services
- `GET /api/services/:id` - Get service by ID
- `POST /api/services` - Create service (Admin only)
- `PUT /api/services/:id` - Update service (Admin only)
- `DELETE /api/services/:id` - Delete service (Admin only)

### Bookings
- `GET /api/bookings` - Get bookings (filtered by role)
- `GET /api/bookings/:id` - Get booking by ID
- `POST /api/bookings` - Create booking (Customer/Admin)
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking

### Payments
- `GET /api/payments` - Get payments (filtered by role)
- `GET /api/payments/:id` - Get payment by ID
- `POST /api/payments` - Create payment (Customer/Admin)
- `PUT /api/payments/:id/refund` - Refund payment (Admin only)
- `GET /api/payments/stats/summary` - Get payment statistics

## Database Models

### User
- Basic user information (name, email, password)
- Role-based access (customer, worker, admin)
- Worker profile with ratings and availability
- Address and contact information

### Service
- Service details (name, description, category)
- Pricing and duration
- Tags and requirements
- Active status

### Booking
- Customer and worker references
- Service reference
- Date and time slots
- Status tracking (pending, confirmed, in-progress, completed, cancelled)
- Payment status
- Location and notes
- Ratings and reviews

### Payment
- Booking reference
- Amount and currency
- Payment method
- Transaction tracking
- Refund support
- Status management

## Authentication & Authorization

### JWT Authentication
All protected routes require a valid JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Role-Based Access Control
- **Customer**: Can book services, view own bookings and payments
- **Worker**: Can view assigned bookings, track earnings
- **Admin**: Full access to all resources

## Error Handling

The API uses standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

Error responses follow this format:
```json
{
  "error": {
    "message": "Error description",
    "status": 400
  }
}
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based authorization middleware
- Input validation and sanitization
- CORS configuration
- Environment variable protection

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run in production mode
npm start
```

## MongoDB Atlas Setup

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster
3. Set up database access (username/password)
4. Whitelist your IP address or use 0.0.0.0/0 for development
5. Get your connection string from the "Connect" button
6. Replace `<username>` and `<password>` in the connection string
7. Add the connection string to your `.env` file

## Project Structure

```
backend/
├── models/           # Mongoose models
│   ├── User.js
│   ├── Service.js
│   ├── Booking.js
│   └── Payment.js
├── routes/           # API routes
│   ├── auth.js
│   ├── users.js
│   ├── services.js
│   ├── bookings.js
│   └── payments.js
├── middleware/       # Express middleware
│   └── auth.js
├── .env             # Environment variables (create this)
├── .env.example     # Example environment variables
├── .gitignore       # Git ignore file
├── package.json     # Dependencies
├── server.js        # Main server file
└── README.md        # This file
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

ISC
