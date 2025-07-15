const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize the Admin SDK
admin.initializeApp();

/**
 * Deletes a user from Firebase Authentication and their corresponding document
 * from the 'users' collection in Firestore.
 * This function is designed to be robust and prevent data inconsistency.
 */
exports.deleteUser = functions.https.onRequest((req, res) => {
    // Use CORS to allow requests from your web app
    cors(req, res, async () => {
        // Ensure the request is a POST request
        if (req.method !== 'POST') {
            return res.status(405).send({ error: 'Method Not Allowed' });
        }

        // TODO: Add robust security. Check if the request comes from an authenticated admin user.
        // For example:
        // const idToken = req.get('Authorization')?.split('Bearer ')[1];
        // if (!idToken) {
        //     return res.status(401).send({ error: 'Unauthorized' });
        // }
        // try {
        //     const decodedToken = await admin.auth().verifyIdToken(idToken);
        //     if (!decodedToken.admin) { // Check for a custom admin claim
        //          return res.status(403).send({ error: 'Permission denied' });
        //     }
        // } catch (error) {
        //     return res.status(401).send({ error: 'Unauthorized' });
        // }

        const { uid } = req.body;
        if (!uid) {
            return res.status(400).send({ error: 'The "uid" property is required in the request body.' });
        }

        try {
            // --- Start of Fix ---
            // Step 1: Attempt to delete the user from Firebase Authentication.
            // We wrap this in a try/catch block to handle the specific error where
            // the user has already been deleted from Auth.
            try {
                await admin.auth().deleteUser(uid);
                console.log(`Successfully deleted user ${uid} from Firebase Authentication.`);
            } catch (error) {
                // If the error is 'user-not-found', it means the user is already
                // deleted from Auth. We can ignore this error and proceed to delete
                // their data from Firestore to resolve the inconsistency.
                if (error.code === 'auth/user-not-found') {
                    console.log(`User ${uid} not found in Authentication. They may have been deleted previously. Proceeding with Firestore cleanup.`);
                } else {
                    // If it's a different error, we should throw it to be caught
                    // by the outer catch block.
                    throw error;
                }
            }

            // Step 2: Delete the user's document from the 'users' collection in Firestore.
            // This ensures that even if the user was already gone from Auth, their
            // data is removed from the database, fixing the inconsistency.
            const userDocRef = admin.firestore().collection('users').doc(uid);
            await userDocRef.delete();
            console.log(`Successfully deleted user document ${uid} from Firestore.`);
            // --- End of Fix ---

            // Return a success response
            return res.status(200).send({ success: true, message: `Successfully deleted all data for user ${uid}.` });

        } catch (error) {
            console.error(`An error occurred while deleting user ${uid}:`, error);
            return res.status(500).send({ error: 'Internal Server Error', message: error.message });
        }
    });
});
