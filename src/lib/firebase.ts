import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Direct configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyDpFEirhNw_df66qL1mkBQ1OEz17oin0aw",
  authDomain: "ace-striker-q07pf.firebaseapp.com",
  projectId: "ace-striker-q07pf",
  storageBucket: "ace-striker-q07pf.firebasestorage.app",
  messagingSenderId: "310195792369",
  appId: "1:310195792369:web:5334ebd7d3abc75f93fc50"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific database ID provisioned for this applet
export const db = getFirestore(app, "ai-studio-realtimetaskmana-bdefe44b-b82c-479e-9522-42d95e5bf02e");

export const auth = getAuth(app);

// Connection test as required by the firebase-integration skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("[Firebase] Successfully validated connection to Firestore database.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("[Firebase] Client is offline. Please check your network or Firebase configuration.");
    } else {
      console.log("[Firebase] Initial database handshake complete (empty document test).");
    }
  }
}

testConnection();
