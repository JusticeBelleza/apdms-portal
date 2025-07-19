// Import the necessary modules from the Firebase SDK.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// Initialize the Admin SDK.
admin.initializeApp();

/**
 * UPDATED SECURE FUNCTION
 * Processes a submission and now sends notifications to the relevant facility users.
 */
exports.processSubmission = onCall(async (request) => {
  // 1. Security & Authorization Checks
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'PHO Admin') {
    throw new HttpsError("permission-denied", "You do not have permission to perform this action.");
  }

  // 2. Get Data and Update Submission
  const { submissionId, newStatus, rejectionReason } = request.data;
  if (!submissionId || !['approved', 'rejected'].includes(newStatus)) {
      throw new HttpsError("invalid-argument", "Required data is missing or invalid.");
  }
  const submissionRef = admin.firestore().collection('submissions').doc(submissionId);
  await submissionRef.update({
    status: newStatus,
    rejectionReason: newStatus === 'rejected' ? rejectionReason : null,
    processedBy: request.auth.uid,
    processedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Fetch submission data to use for both Audit Log and Notifications
  const submissionDoc = await submissionRef.get();
  if (!submissionDoc.exists) {
    logger.error("Could not find submission after update.", { submissionId });
    // Still return success as the primary action was completed.
    return { success: true, message: "Action succeeded, but post-action tasks failed." };
  }
  const submissionData = submissionDoc.data();
  const adminUserData = userDoc.data();

  // 3. --- FIX: Create More Descriptive Audit Log ---
  await admin.firestore().collection('audit_logs').add({
      action: `Submission ${newStatus}`,
      performedBy: request.auth.uid,
      userName: adminUserData.name,
      userRole: adminUserData.role,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: `${submissionData.programName} submission from ${submissionData.userName} was ${newStatus} by ${adminUserData.name}.`
  });

  // 4. Create and Send Notifications
  try {
    const facilityId = submissionData.facilityId;

    if (!facilityId) {
      logger.error("Submission is missing a facilityId, cannot send notifications.", { submissionId });
      return { success: true, message: "Action succeeded, but submission has no facility to notify." };
    }

    const usersQuery = admin.firestore().collection('users').where('facilityId', '==', facilityId);
    const usersSnapshot = await usersQuery.get();

    if (usersSnapshot.empty) {
        logger.log("No users found for facility to notify.", { facilityId });
        return { success: true, message: "Action succeeded, no users to notify." };
    }

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

  } catch(error) {
      logger.error("Failed to send notifications after submission processing:", error, { submissionId });
  }

  return { success: true, message: `Submission successfully ${newStatus} and notifications sent.` };
});


// --- Your other functions (setUserRole, deleteUser, etc.) remain unchanged below ---

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
    throw new HttpsError("internal", "Unable to set user role.");
  }
});

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
    throw new HttpsError("internal", "Unable to delete user.");
  }
});

exports.addTimestamp = onDocumentCreated("users/{userId}", (event) => {
    const snap = event.data;
    if (!snap) {
        logger.log("No data associated with the event, skipping.");
        return;
    }
    return snap.ref.set({ createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
});

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
