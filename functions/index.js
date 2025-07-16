// Import the necessary modules from the Firebase SDK.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

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
    console.error("Error setting user role:", error);
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
    console.error("Error deleting user:", error);
    throw new HttpsError("internal", "Unable to delete user.");
  }
});


/**
 * Adds a 'createdAt' timestamp to new user documents in Firestore.
 * This uses the modern v2 syntax for Firestore triggers.
 */
exports.addTimestamp = onDocumentCreated("users/{userId}", (event) => {
    const snap = event.data;
    if (!snap) {
        console.log("No data associated with the event, skipping.");
        return;
    }
    // Set the 'createdAt' field on the new document.
    return snap.ref.set(
      { createdAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  });