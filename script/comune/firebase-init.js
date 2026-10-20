import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyC43OgUlepmGho-fGRrl4_BZpu3GnIYbAw",
    authDomain: "olimpiadi-radiologia.firebaseapp.com",
    projectId: "olimpiadi-radiologia",
    storageBucket: "olimpiadi-radiologia.firebasestorage.app",
    messagingSenderId: "609536055903",
    appId: "1:609536055903:web:9bbe333408a98b6ad819ea"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
