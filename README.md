APDMS Portal: Disease Monitoring and Surveillance System
The APDMS Portal is a comprehensive, role-based web application designed for monitoring and managing public health data, likely for the Philippine Integrated Disease Surveillance and Response (PIDSR) program. It provides a centralized platform for various user roles—including general, facility, and administrative staff—to handle data submissions, manage facilities, oversee users, and visualize key metrics through intuitive dashboards.

Key Features
Role-Based Access Control (RBAC): Custom dashboards and permissions for different user roles (System Admin, PHO Admin, Facility Admin, Facility User).

Interactive Dashboards: Visualizes key data points and statistics using Chart.js for quick insights.

User Management: Admins can create, view, and manage user accounts and their associated roles and permissions.

Facility Management: Admins can add new healthcare facilities and assign administrative users to them.

Secure Data Submission: A streamlined process for users to upload and submit PIDSR data files.

Submission History & Tracking: View the status and history of all data submissions.

Audit Logging: A secure, server-side audit trail tracks critical actions performed by users, such as user creation and data submission.

Notification System: In-app notifications to keep users informed of important events.

Secure Authentication: Built on Firebase Authentication for reliable and secure user login.

Technology Stack
Frontend:

React: A JavaScript library for building user interfaces.

React Router: For declarative routing within the application.

Tailwind CSS: A utility-first CSS framework for rapid UI development.

Chart.js: For creating responsive and interactive charts.

Backend & Database:

Firebase: A comprehensive platform for building web and mobile applications.

Firestore: A NoSQL cloud database for storing application data.

Firebase Authentication: For handling user authentication.

Cloud Storage: To store user-uploaded files and reports.

Cloud Functions: For running server-side logic in a serverless environment (e.g., creating users, logging actions).

Project Structure
The project follows a standard Create React App structure with a logical organization of files and folders.

/
├── functions/              # Backend Cloud Functions for Firebase
├── public/                 # Static assets and index.html
├── src/
│   ├── components/         # Reusable React components (modals, layout, etc.)
│   ├── context/            # React Context for global state (UserContext)
│   ├── firebase/           # Firebase configuration and initialization
│   ├── pages/              # Top-level page components
│   ├── utils/              # Helper functions and utilities
│   └── App.js              # Main application component with routing
├── firebase.json           # Firebase project configuration
├── firestore.rules         # **CRITICAL:** Security rules for Firestore
└── storage.rules           # **CRITICAL:** Security rules for Cloud Storage

🚨 CRITICAL SECURITY WARNING 🚨
DO NOT DEPLOY THIS APPLICATION TO PRODUCTION WITH THE CURRENT SECURITY RULES.

The default firestore.rules and storage.rules in the repository are configured to deny all access or allow universal access, respectively. This is extremely dangerous and will either break your application or expose all user data.

You MUST implement granular security rules before deployment. Please refer to the APDMS Portal Code Assessment document for secure, role-based rule examples that you should adapt and apply to your project.

Setup and Installation
Follow these steps to get the project running on your local machine.

Prerequisites
Node.js (v16 or later recommended)

Firebase CLI (npm install -g firebase-tools)

1. Clone the Repository
git clone <your-repository-url>
cd apdms-portal

2. Install Dependencies
This project has separate dependencies for the frontend application and the backend Cloud Functions. You must install both.

# Install dependencies for the React frontend (from the root directory)
npm install

# Install dependencies for the Cloud Functions
cd functions
npm install
cd ..

3. Set Up Firebase
Go to the Firebase Console and create a new project.

In your new project, go to Project Settings > General.

Under "Your apps", click the web icon (</>) to register a new web app.

Copy the firebaseConfig object. You will need it in the next step.

Enable the following services in the Firebase Console:

Authentication: Enable the Email/Password sign-in method.

Firestore Database: Create a new database in production mode.

Storage: Create a new storage bucket.

4. Configure Environment Variables
In the src/firebase/ directory, locate the config.js file.

Replace the placeholder configuration with the firebaseConfig object you copied from the Firebase console.

// src/firebase/config.js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

5. Run the Development Server
Once all dependencies are installed and the configuration is set, you can start the React development server.

# From the root directory
npm start

The application will be available at http://localhost:3000.

6. Deploy Cloud Functions
To use features like user creation and audit logging, you must deploy your Cloud Functions.

# Login to Firebase
firebase login

# Deploy functions
firebase deploy --only functions

Available Scripts
npm start: Runs the app in development mode.

npm test: Launches the test runner.

npm run build: Builds the app for production.

npm run eject: Ejects from Create React App (use with caution).

Deployment
The frontend can be easily deployed using Firebase Hosting.

Build the application:

npm run build

Deploy to Firebase:

firebase deploy --only hosting

Remember to deploy your security rules and functions as well:
firebase deploy --only firestore:rules,storage,functions
