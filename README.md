# Pure App Weave

A modern health and service management application built with React, TypeScript, and MongoDB Atlas.

## Project Overview

Pure App Weave is a comprehensive platform for managing health services, bookings, and worker coordination. It includes separate dashboards for customers, workers, and administrators.

## Technologies Used

**Frontend:**
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- React Router
- TanStack Query

**Backend:**
- Node.js
- Express
- MongoDB Atlas
- Mongoose

## Getting Started

### Prerequisites

- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- MongoDB Atlas account

### Installation

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd pure-app-weave-main

# Step 3: Install frontend dependencies
npm install

# Step 4: Navigate to backend and install dependencies
cd backend
npm install

# Step 5: Configure environment variables
# Create a .env file in the backend directory with your MongoDB Atlas connection string
# MONGODB_URI=your_mongodb_atlas_connection_string
# PORT=5000

# Step 6: Start the backend server
npm run dev

# Step 7: In a new terminal, start the frontend development server
cd ..
npm run dev
```

## Project Structure

- `/src` - Frontend React application
  - `/components` - Reusable UI components
  - `/pages` - Application pages (customer, worker, admin)
  - `/hooks` - Custom React hooks
  - `/lib` - Utility functions
- `/backend` - Express backend server
  - `/models` - MongoDB models
  - `/routes` - API routes
  - `/middleware` - Express middleware

## Features

- Customer booking management
- Worker dashboard and earnings tracking
- Admin panel for oversight
- Authentication and authorization
- Payment processing
- Service management

## Development

```sh
# Run frontend tests
npm run test

# Run frontend in development mode
npm run dev

# Build for production
npm run build
```

## Deployment

Build the frontend and deploy both frontend and backend to your preferred hosting platform. Make sure to set environment variables for production.
