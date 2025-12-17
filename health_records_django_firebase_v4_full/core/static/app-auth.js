const cfg = window.firebaseConfig;
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
const app = initializeApp(cfg);

import {
  getAuth, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  getFirestore, doc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const el = (id) => document.getElementById(id);
const msg = el("msg");

const regEmail = el("regEmail");
const regPassword = el("regPassword");
const regRole = el("regRole");
const doctorEnrollWrap = el("doctorEnrollWrap");
const doctorEnrollCode = el("doctorEnrollCode");

const modeEmail = document.getElementById("modeEmail");
const modeUid   = document.getElementById("modeUid");
const loginByEmail = document.getElementById("loginByEmail");
const loginByUid   = document.getElementById("loginByUid");
const loginEmail = el("loginEmail");
const loginUid   = el("loginUid");
const loginPassword = el("loginPassword");

function refreshLoginMode() {
  const useUid = modeUid?.checked;
  if (loginByEmail) loginByEmail.style.display = useUid ? "none" : "block";
  if (loginByUid)   loginByUid.style.display   = useUid ? "block" : "none";
}
modeEmail?.addEventListener("change", refreshLoginMode);
modeUid?.addEventListener("change", refreshLoginMode);
refreshLoginMode();

el("regRole")?.addEventListener("change", () => {
  doctorEnrollWrap.style.display = regRole.value === "doctor" ? "block" : "none";
});

el("btnRegister")?.addEventListener("click", async () => {
  msg.textContent = "";
  const email = (regEmail.value || "").trim();
  const password = (regPassword.value || "").trim();
  const role = regRole.value;

  if (!email || !password) { msg.textContent = "Enter email and password."; return; }

  if (role === "doctor") {
    const required = (window.DOCTOR_ENROLL_CODE || "").trim();
    if (!required || (doctorEnrollCode?.value || "").trim() !== required) {
      msg.textContent = "Invalid doctor enroll code."; return;
    }
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), { email, role, createdAt: new Date() });
    await setDoc(doc(db, "uid2email", cred.user.uid), { email });
    window.location.href = "/dashboard/";
  } catch (e) {
    msg.textContent = e.message || String(e);
  }
});

el("btnLogin")?.addEventListener("click", async () => {
  msg.textContent = "";
  const password = (loginPassword.value || "").trim();

  try {
    if (modeUid?.checked) {
      const uid = (loginUid.value || "").trim();
      if (!uid || !password) { msg.textContent = "Enter UID and password."; return; }

      const ref = doc(db, "uid2email", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) { msg.textContent = "UID not found. Check your UID."; return; }

      const email = snap.data().email;
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const email = (loginEmail.value || "").trim();
      if (!email || !password) { msg.textContent = "Enter email and password."; return; }
      await signInWithEmailAndPassword(auth, email, password);
    }

    window.location.href = "/dashboard/";
  } catch (e) {
    msg.textContent = e.message || String(e);
  }
});

onAuthStateChanged(auth, () => {});
