# Toyota S.O.S - Driver Management Application

## Project Overview

Toyota S.O.S is a Next.js-based web application for managing driver tasks and vehicle transportation for Toyota Hadera. The application supports multiple user roles (admin, manager, driver, viewer) with role-based access control and features a modern, mobile-responsive interface with Hebrew language support.

## Tech Stack

### Core Framework
- **Next.js 16.0.1** - React framework with App Router
- **React 19.2.0** - UI library
- **TypeScript 5** - Type safety

### UI & Styling
- **Tailwind CSS 4.1.17** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **Framer Motion** - Animation library
- **Recharts** - Data visualization charts

### Backend & Database
- **Supabase** - Backend-as-a-Service (authentication, database, real-time)
- **Zod** - Schema validation

### Additional Features
- **PWA Support** - Progressive Web App capabilities
- **Push Notifications** - Web push notifications
- **Offline Support** - Service worker implementation
- **Analytics** - Mixpanel integration
- **Drag & Drop** - @dnd-kit for sortable interfaces

## Project Structure

```
toyota-sos/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin dashboard pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── driver/            # Driver interface pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── admin/            # Admin-specific components
│   ├── driver/           # Driver-specific components
│   ├── ui/               # Reusable UI components
│   └── notifications/    # Notification components
├── types/                # TypeScript type definitions
│   ├── board.ts          # Board/task management types
│   ├── entity.ts         # Core entity types
│   ├── task.ts           # Task-related types
│   └── user.ts           # User/auth types
└── lib/                  # Utility functions and configurations
```

## Key Features

### Multi-Role Support
- **Admin**: Full system management access
- **Manager**: Team and task oversight
- **Driver**: Task management and execution
- **Viewer**: Read-only access

### Core Functionality
- Task assignment and tracking
- Real-time updates via Supabase
- Mobile-responsive design
- Hebrew language interface
- Push notifications
- Offline capabilities
- Data visualization with charts
- Drag-and-drop task management

## Development Commands

```bash
# Development
npm run dev              # Start development server on localhost:3000

# Build & Production
npm run build           # Create production build (telemetry disabled)
npm run start           # Start production server

# Code Quality
npm run lint           # Run ESLint
npm run test           # Run Jest tests
npm run test:watch     # Run tests in watch mode
```

## Environment Setup

The application uses Supabase for backend services. Ensure proper environment variables are configured for:
- Database connection
- Authentication
- Real-time subscriptions
- Push notifications

## Authentication Flow

The app implements role-based authentication with automatic redirects:
- Landing page (`/`) redirects authenticated users based on role
- Drivers → `/driver`
- Admins/Managers → `/admin/dashboard`
- Viewers → `/viewer`

## Mobile & PWA Features

- Progressive Web App with offline support
- Service worker for caching and background sync
- Install prompt for mobile devices
- Responsive design optimized for mobile usage
- Hebrew RTL text support

## Development Notes

- Uses modern React 19 features
- Implements TypeScript strict mode
- Follows Next.js 16 best practices with App Router
- Utilizes Supabase real-time subscriptions
- Includes comprehensive testing setup with Jest
- Implements proper error boundaries and loading states

## Testing

- Jest testing framework configured
- React Testing Library for component testing
- User Event library for interaction testing
- Tests run with `--passWithNoTests` flag for CI/CD compatibility

## Build Optimizations

- Next.js telemetry disabled for faster builds
- Automatic font optimization with Geist font family
- Image optimization through Next.js Image component
- CSS optimization via Tailwind CSS