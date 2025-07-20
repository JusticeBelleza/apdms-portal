// Import the necessary modules from the Firebase SDK.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// Initialize the Admin SDK.
admin.initializeApp();

/**
 * NEW: Fetches system health data (error counts).
 * This function is protected and can only be called by a 'Super Admin'.
 */
exports.getSystemHealth = onCall(async (request) => {
  // Authorization check: only Super Admins can call this
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'Super Admin') {
    throw new HttpsError("permission-denied", "You do not have permission to perform this action.");
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const errorsQuery = admin.firestore().collection('system_errors').where('timestamp', '>=', twentyFourHoursAgo);
    const errorsSnapshot = await errorsQuery.get();
    
    return { errorCount: errorsSnapshot.size };
  } catch (error) {
    logger.error("Error fetching system health:", error);
    throw new HttpsError("internal", "Could not fetch system health data.");
  }
});


/**
 * Processes a submission and sends notifications.
 */
exports.processSubmission = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'PHO Admin') {
    throw new HttpsError("permission-denied", "You do not have permission to perform this action.");
  }

  const { submissionId, newStatus, rejectionReason } = request.data;
  if (!submissionId || !['approved', 'rejected'].includes(newStatus)) {
      throw new HttpsError("invalid-argument", "Required data is missing or invalid.");
  }

  try {
    const submissionRef = admin.firestore().collection('submissions').doc(submissionId);
    await submissionRef.update({
      status: newStatus,
      rejectionReason: newStatus === 'rejected' ? rejectionReason : null,
      processedBy: request.auth.uid,
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const submissionDoc = await submissionRef.get();
    if (!submissionDoc.exists) {
      logger.error("Could not find submission after update.", { submissionId });
      return { success: true, message: "Action succeeded, but post-action tasks failed." };
    }
    const submissionData = submissionDoc.data();
    const adminUserData = userDoc.data();

    await admin.firestore().collection('audit_logs').add({
        action: `Submission ${newStatus}`,
        performedBy: request.auth.uid,
        userName: adminUserData.name,
        userRole: adminUserData.role,
        facilityId: submissionData.facilityId || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: `${submissionData.programName} submission from ${submissionData.userName} was ${newStatus} by ${adminUserData.name}.`
    });

    // Notification logic...
    const facilityId = submissionData.facilityId;
    if (facilityId) {
        const usersQuery = admin.firestore().collection('users').where('facilityId', '==', facilityId);
        const usersSnapshot = await usersQuery.get();
        if (!usersSnapshot.empty) {
            const batch = admin.firestore().batch();
            const notificationTitle = `Submission ${newStatus}: ${submissionData.programName}`;
            const notificationMessage = newStatus === 'approved'
                ? `Your submission for ${submissionData.programName} has been approved.`
                : `Your submission for ${submissionData.programName} was rejected. Reason: "${rejectionReason}"`;

            usersSnapshot.forEach(doc => {
                const notificationRef = admin.firestore().collection('notifications').doc();
                batch.set(notificationRef, {
                    userId: doc.id,
                    title: notificationTitle,
                    message: notificationMessage,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    isRead: false,
                    relatedSubmissionId: submissionId,
                });
            });
            await batch.commit();
            logger.log(`Sent ${usersSnapshot.size} notifications for submission processing.`, { submissionId });
        }
    }
    return { success: true, message: `Submission successfully ${newStatus} and notifications sent.` };

  } catch (error) {
    logger.error("Error processing submission:", error);
    await admin.firestore().collection('system_errors').add({
        functionName: 'processSubmission',
        errorMessage: error.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        context: request.data
    });
    throw new HttpsError("internal", "An error occurred while processing the submission.");
  }
});

/**
 * Sets a custom role for a user.
 */
exports.setUserRole = onCall(async (request) => {
  if (!request.auth) { throw new HttpsError("unauthenticated", "The function must be called while authenticated."); }
  const callerClaims = request.auth.token;
  if (callerClaims.role !== "Super Admin" && callerClaims.role !== "PHO Admin") { throw new HttpsError("permission-denied", "You do not have permission to set user roles.");}
  
  const { uid, role } = request.data;
  try {
    await admin.auth().setCustomUserClaims(uid, { role: role });
    await admin.firestore().collection("users").doc(uid).update({ role: role });
    return { message: `Success! Role for user ${uid} has been set to ${role}` };
  } catch (error) {
    logger.error("Error setting user role:", error);
    await admin.firestore().collection('system_errors').add({
        functionName: 'setUserRole',
        errorMessage: error.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        context: request.data
    });
    throw new HttpsError("internal", "Unable to set user role.");
  }
});

/**
 * Deletes a user from Authentication and Firestore.
 */
exports.deleteUser = onCall(async (request) => {
  if (!request.auth) { throw new HttpsError("unauthenticated", "The function must be called while authenticated."); }
  const callerClaims = request.auth.token;
  if (callerClaims.role !== "Super Admin" && callerClaims.role !== "PHO Admin") { throw new HttpsError("permission-denied", "You do not have permission to delete users."); }
  
  const { uid } = request.data;
  try {
    await admin.auth().deleteUser(uid);
    await admin.firestore().collection("users").doc(uid).delete();
    return { message: `Successfully deleted user ${uid}` };
  } catch (error) {
    logger.error("Error deleting user:", error);
    await admin.firestore().collection('system_errors').add({
        functionName: 'deleteUser',
        errorMessage: error.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        context: request.data
    });
    throw new HttpsError("internal", "Unable to delete user.");
  }
});

/**
 * Adds a 'createdAt' timestamp to new user documents in Firestore.
 */
exports.addTimestamp = onDocumentCreated("users/{userId}", (event) => {
    const snap = event.data;
    if (!snap) {
        logger.log("No data associated with the event, skipping.");
        return;
    }
    return snap.ref.set({ createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
});

/**
 * Handles file cleanup when a submission status is changed.
 */
exports.handleSubmissionStatusChange = onDocumentUpdated("submissions/{submissionId}", async (event) => {
  const newData = event.data.after.data();
  const oldData = event.data.before.data();
  if (newData.status === "rejected" && oldData.status !== "rejected") {
    if (newData.fileURL) {
      try {
        const bucket = admin.storage().bucket();
        let filePath;
        if (newData.fileURL.startsWith('gs://')) {
          const bucketName = newData.fileURL.split('/')[2];
          filePath = newData.fileURL.substring(`gs://${bucketName}/`.length);
        } else {
          const fileUrl = new URL(newData.fileURL);
          filePath = decodeURIComponent(fileUrl.pathname.split("/o/")[1]);
        }
        logger.log(`Deleting rejected file from Cloud Storage: ${filePath}`);
        await bucket.file(filePath).delete();
        logger.log("Successfully deleted rejected file.");
      } catch (error) {
        logger.error("Failed to delete rejected file from Cloud Storage:", error);
      }
    }
    return null;
  }
  return null;
});
