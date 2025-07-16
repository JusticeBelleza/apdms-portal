// Import v2 functions
const { onRequest } = require("firebase-functions/v2/https");
const { onObjectDeleted } = require("firebase-functions/v2/storage");
const { setGlobalOptions } = require("firebase-functions/v2");

const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize the Admin SDK (only once)
admin.initializeApp();
const db = admin.firestore();

// Set global options (e.g., region) if needed
setGlobalOptions({ region: "us-central1" });

/**
 * Deletes a user from Firebase Auth and their Firestore document.
 * Uses the v2 'onRequest' handler.
 */
exports.deleteUser = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method Not Allowed' });
    }

    // TODO: Add robust security to verify the request comes from an admin.
    
    const { uid } = req.body;
    if (!uid) {
        return res.status(400).send({ error: 'The "uid" property is required.' });
    }

    try {
        try {
            await admin.auth().deleteUser(uid);
            console.log(`Successfully deleted user ${uid} from Firebase Authentication.`);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log(`User ${uid} not found in Auth. Proceeding with Firestore cleanup.`);
            } else {
                throw error;
            }
        }

        const userDocRef = db.collection('users').doc(uid);
        await userDocRef.delete();
        console.log(`Successfully deleted user document ${uid} from Firestore.`);

        return res.status(200).send({ success: true, message: `Successfully deleted all data for user ${uid}.` });

    } catch (error) {
        console.error(`An error occurred while deleting user ${uid}:`, error);
        return res.status(500).send({ error: 'Internal Server Error', message: error.message });
    }
});


/**
 * Triggers when a file is deleted from Storage and deletes the corresponding
 * Firestore document. Uses the v2 'onObjectDeleted' handler.
 */
exports.syncDeletionToFirestore = onObjectDeleted(async (event) => {
    const file = event.data;
    const filePath = file.name;

    if (!filePath.startsWith("submissions/")) {
        console.log(`File at '${filePath}' is not a submission. Ignoring.`);
        return null;
    }

    console.log(`File deleted: ${filePath}. Searching for matching Firestore document...`);

    try {
        const submissionsRef = db.collection("submissions");
        const snapshot = await submissionsRef.where("storagePath", "==", filePath).limit(1).get();

        if (snapshot.empty) {
            console.warn(`No submission document found with storagePath matching '${filePath}'.`);
            return null;
        }

        const docToDelete = snapshot.docs[0];
        console.log(`Found matching document with ID: ${docToDelete.id}. Deleting...`);
        
        await docToDelete.ref.delete();
        
        console.log(`Successfully deleted Firestore document ${docToDelete.id}.`);
        return null;

    } catch (error) {
        console.error("Error synchronizing deletion to Firestore:", error);
        return null;
    }
});
