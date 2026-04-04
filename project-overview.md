# Project Overview: Trip Expenses Tally App

## 1. Introduction
The **Trip Tally App** is a collaborative platform designed to help groups of friends easily track shared expenses during trips, vacations, or shared living situations. The app tracks who paid for what, calculates "who owes whom," and simplifies the process of settling debts using an optimized debt-simplification algorithm.

## 2. Core Features
*   **Frictionless Access (No Sign-in/up):** Start using the app immediately without creating an account.
*   **Trip/Group Management:** Generate a unique, unguessable URL for a trip and share it with the group via any messaging app or email. Anyone with the link can instantly access the trip.
*   **Expense Tracking:** Add expenses, specify who paid, and select who shares the cost (split equally, by exact amounts, or by percentages).
*   **Balance Calculation:** Real-time tallying of balances using a simplification algorithm to minimize the total number of peer-to-peer transactions needed to settle up.
*   **Receipt Uploads:** Attach images of receipts or invoices to specific expenses.
*   **Activity Feed:** A log of all added, edited, or deleted expenses within a trip.

## 3. Application Architecture
The application follows a modern decoupled architecture, separating the client-side presentation layer from the backend business logic and data storage.

### Frontend (Client-Side)
*   **Web Application:** React.js or Next.js for the initial MVP, providing a responsive experience for both mobile and desktop browsers.
*   **State Management:** Redux Toolkit or Zustand for global state, and React Query for caching asynchronous backend data.

### Backend (Server-Side API)
*   **Architecture:** Serverless microservices.
*   **Compute:** Node.js (with TypeScript for type safety) running on AWS.
*   **API Layer:** RESTful API.

## 4. AWS Architecture
The cloud infrastructure is built entirely on Amazon Web Services (AWS), utilizing managed and serverless components.

*   **API Routing:** **Amazon API Gateway** acts as the front door, routing client HTTP requests. Access is granted to groups via unique shareable links (e.g., using UUIDv4) rather than traditional authentication.
*   **Compute:** **AWS Lambda** executes the backend business logic (e.g., adding an expense, calculating optimized balances) in stateless, scalable containers.
*   **Database:** **Amazon RDS (PostgreSQL)** ensures ACID compliance, referential integrity (Trips -> Members -> Expenses), and handles complex queries.
*   **Storage:** **Amazon S3 (Simple Storage Service)** securely stores user-uploaded receipt images attached to expenses.
*   **Background Processing:** **Amazon EventBridge** and **Amazon SQS** handle asynchronous tasks, such as triggering push notifications when a new expense is added.

## 5. Folder Structure
To maintain a clean separation of concerns, the project uses a monorepo approach with distinct directories for the frontend, backend, and shared resources.

```text
trip-tally/
├── frontend-web/                 # Web Application (React.js / Next.js)
│   ├── src/
│   │   ├── app/              # Next.js App Router (pages and layouts)
│   │   ├── components/       # Reusable UI components (buttons, list items)
│   │   ├── store/            # Client state management (Zustand/Redux)
│   │   ├── hooks/            # Custom React hooks (React Query mutations/queries)
│   │   ├── api/              # API client for backend communication
│   │   └── utils/            # Helper functions (e.g., currency formatting)
│   ├── next.config.js        # Next.js configuration (if using Next.js)
│   └── package.json
├── backend/                  # Serverless AWS Backend (Node.js/TypeScript)
│   ├── src/
│   │   ├── functions/        # AWS Lambda handlers (entry points for API endpoints)
│   │   ├── services/         # Core business logic (e.g., Debt simplification algorithm)
│   │   ├── db/               # Database connection, migrations, and query builders
│   │   └── utils/            # Helpers (e.g., S3 presigned URL generation)
│   └── package.json
├── infrastructure/           # AWS CDK Infrastructure as Code
│   ├── bin/                  # CDK app entry point
│   ├── lib/                  # CDK stacks (Database, API, Lambdas)
│   ├── cdk.json              # CDK configuration
│   └── package.json
├── shared/                   # Shared resources
│   └── types/                # TypeScript interfaces shared between frontend and backend
└── project-overview.md       # Project documentation
```
