// Import the necessary modules from the Firebase SDK.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// Initialize the Admin SDK.
admin.initializeApp();

/**
 * Sets a custom role for a user.
 * This function is protected and can only be called by a 'Super Admin' or 'PHO Admin'.
 */
exports.setUserRole = onCall(async (request) => {
  // Ensure the user is authenticated.
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const callerClaims = request.auth.token;
  // Ensure the user has permission to set roles.
  if (callerClaims.role !== "Super Admin" && callerClaims.role !== "PHO Admin") {
    throw new HttpsError(
      "permission-denied",
      "You do not have permission to set user roles."
    );
  }

  // Set custom claims and update the Firestore document.
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

/**
 * Deletes a user from Authentication and Firestore.
 * This function is protected and can only be called by a 'Super Admin' or 'PHO Admin'.
 */
exports.deleteUser = onCall(async (request) => {
  // Ensure the user is authenticated.
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const callerClaims = request.auth.token;
  // Ensure the user has permission to delete users.
  if (callerClaims.role !== "Super Admin" && callerClaims.role !== "PHO Admin") {
    throw new HttpsError(
      "permission-denied",
      "You do not have permission to delete users."
    );
  }

  // Proceed with deletion.
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


/**
 * Adds a 'createdAt' timestamp to new user documents in Firestore.
 */
exports.addTimestamp = onDocumentCreated("users/{userId}", (event) => {
    const snap = event.data;
    if (!snap) {
        logger.log("No data associated with the event, skipping.");
        return;
    }
    // Set the 'createdAt' field on the new document.
    return snap.ref.set(
      { createdAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
});

/**
 * NEW FUNCTION
 * Handles file cleanup when a submission status is changed.
 * Specifically, it deletes the file from Storage if the status becomes "rejected".
 */
exports.handleSubmissionStatusChange = onDocumentUpdated("submissions/{submissionId}", async (event) => {
  const newData = event.data.after.data();
  const oldData = event.data.before.data();

  // Check if the status was changed to 'rejected' from something else.
  if (newData.status === "rejected" && oldData.status !== "rejected") {
    
    // If the submission had a fileURL, proceed to delete it from storage.
    if (newData.fileURL) {
      try {
        // Extract the file path from the full gs:// or https:// URL
        const fileUrl = new URL(newData.fileURL);
        const filePath = decodeURIComponent(fileUrl.pathname.split("/o/")[1]);
        
        const bucket = admin.storage().bucket();
        
        logger.log(`Deleting rejected file from Cloud Storage: ${filePath}`);
        await bucket.file(filePath).delete();
        logger.log("Successfully deleted rejected file.");

      } catch (error) {
        logger.error("Failed to delete rejected file from Cloud Storage:", error);
        // We don't throw an error here to prevent the Firestore update from failing
        // if the file deletion has an issue.
      }
    }
    return null;
  }

  // We are not handling the 'approved' case here, but if you wanted to move
  // the file from 'pending/' to 'approved/', this is where you would add that logic.
  
  return null;
});