const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

admin.initializeApp();

exports.deleteUser = functions.https.onRequest((req, res) => {
  // Use the cors middleware to handle the request
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).send({ error: 'Unauthorized: No token provided.' });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const callerUid = decodedToken.uid;

      const userDocRef = admin.firestore().collection("users").doc(callerUid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists || userDoc.data().role !== "Super Admin") {
        return res.status(403).send({ error: 'Permission denied: User is not a Super Admin.' });
      }

      const uidToDelete = req.body.data.uid;
      if (!uidToDelete) {
        return res.status(400).send({ error: 'Bad Request: UID to delete is missing.' });
      }

      await admin.auth().deleteUser(uidToDelete);
      console.log(`Successfully deleted user with UID: ${uidToDelete}`);
      return res.status(200).send({ data: { message: `Successfully deleted user ${uidToDelete}.` } });

    } catch (error) {
      console.error("Error in deleteUser function:", error);
      if (error.code === 'auth/id-token-expired') {
        return res.status(401).send({ error: 'Unauthorized: Token expired.' });
      }
      return res.status(500).send({ error: `Internal Server Error: ${error.message}` });
    }
  });
});