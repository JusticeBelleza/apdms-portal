Abra PHO Data Management System (APDMS)
1. Overview
The Abra Provincial Health Office (PHO) Data Management System is a web-based portal designed to streamline the collection, management, and analysis of annual program data from various health facilities. It provides a centralized platform for facility users to submit data, PHO administrators to review and manage submissions, and super administrators to oversee the entire system.

The application features role-based access control to ensure data security and integrity, with different dashboards and permissions tailored to each user type.

2. Key Features
Role-Based Dashboards: Customized views for Super Admins, PHO Admins, Facility Admins, and Facility Users.

User Management: Admins can create, update, and manage user accounts and their associated roles.

Facility Management: Admins can add and manage health facilities within the system.

Secure Data Submission: A structured process for facilities to upload their annual program data and supporting documents.

Data Visualization: Interactive charts and graphs for analyzing submitted data.

Reporting: Generate reports based on the collected data.

Audit Logs: Track important system activities for accountability.

Real-time Notifications: In-app notifications for important events and updates.

3. Technology Stack
Frontend: React, React Router, Tailwind CSS

Backend & Database: Firebase (Authentication, Firestore, Storage, Hosting)

Charting: Chart.js

State Management: React Context API

4. Prerequisites
Before you begin, ensure you have the following installed:

Node.js (LTS version recommended)

npm or yarn package manager

Firebase CLI (npm install -g firebase-tools)

You will also need a Firebase project. If you don't have one, create one at the Firebase Console.

5. Installation and Local Setup
Step 1: Clone the Repository
git clone <your-repository-url>
cd apdms-portal

Step 2: Install Dependencies
Install the required npm packages for the project root and the functions directory.

# Install root dependencies
npm install

# Navigate to functions directory and install its dependencies
cd functions
npm install
cd ..

Step 3: Configure Firebase
In the Firebase Console, go to your project's settings.

Under "Your apps", create a new Web app.

Copy the firebaseConfig object.

Step 4: Set Up Environment Variables
Create a file named .env.local in the root of the project. Paste your firebaseConfig keys into this file, prefixing each key with REACT_APP_.

File: .env.local

REACT_APP_FIREBASE_API_KEY="your-api-key"
REACT_APP_FIREBASE_AUTH_DOMAIN="your-auth-domain"
REACT_APP_FIREBASE_PROJECT_ID="your-project-id"
REACT_APP_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
REACT_APP_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
REACT_APP_FIREBASE_APP_ID="your-app-id"

Important: You must update src/firebase/config.js to read these environment variables instead of using hardcoded values.

Step 5: Run the Development Server
npm start

The application should now be running locally at http://localhost:3000.

6. CRITICAL Security Configuration
Your application will not function correctly and will be insecure without these changes.

1. Firestore Rules (firestore.rules)
The current rules (allow read, write: if false;) block all database access. You must replace them with rules that grant access based on user roles.

Example (This is a basic template, customize it for your needs):

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow admins to read/write anything
    match /{document=**} {
      allow read, write: if request.auth.token.role == 'admin';
    }

    // Allow facility users to only read/write their own data
    match /facilities/{facilityId}/{documents=**} {
      allow read, write: if request.auth.uid != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.facilityId == facilityId;
    }
  }
}

2. Storage Rules (storage.rules)
The current rules allow any authenticated user to access any file. Tighten them to restrict access based on facility or user.

Example:

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Only allow users to upload to a path corresponding to their facility ID
    match /submissions/{facilityId}/{fileName} {
      allow write: if request.auth != null && resource.size < 10 * 1024 * 1024
                   && request.auth.token.facilityId == facilityId;
      allow read: if request.auth != null && request.auth.token.facilityId == facilityId;
    }
  }
}

Note: The examples above assume you are using Firebase Custom Claims to set user roles (role, facilityId). You will need to implement a Firebase Function to set these claims when a user is created or updated.

7. Deployment to Firebase Hosting
Step 1: Correct the Hosting Configuration
In firebase.json, change the public directory from "public" to "build". This is essential for deploying a Create React App project.

File: firebase.json

{
  "hosting": {
    "public": "build", // <-- CHANGE THIS
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
  // ... other configs
}

Step 2: Build the Application
npm run build

Step 3: Deploy
firebase deploy

This command will deploy your hosting configuration, Firestore rules, Storage rules, and any Firebase Functions.
