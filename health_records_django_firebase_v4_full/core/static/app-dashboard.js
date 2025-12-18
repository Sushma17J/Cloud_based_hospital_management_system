const cfg = window.firebaseConfig;
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
const app = initializeApp(cfg);

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const el = (id) => document.getElementById(id);
const whoamiSpan = el("whoami");
const btnLogout = el("btnLogout");

// Records
const recordForm = el("recordForm");
const recId = el("recId");
const recTitle = el("recTitle");
const recNotes = el("recNotes");
const patientIdInput = el("patientIdInput");
const formMsg = el("formMsg");
const formTitle = el("formTitle");
const btnCancel = el("btnCancel");

const doctorOnlyFields = el("doctorOnlyFields");
const doctorFilters = el("doctorFilters");
const filterByPatient = el("filterByPatient");
const btnClearFilter = el("btnClearFilter");

const recordsDiv = el("records");
const recordTpl = el("recordTpl");

// Appointments
const apptDoctorCard = el("apptDoctorCard");
const apptForm = el("apptForm");
const apptPatientUid = el("apptPatientUid");
const apptTitle = el("apptTitle");
const apptWhen = el("apptWhen");
const apptNotes = el("apptNotes");
const apptMsg = el("apptMsg");
const apptsDiv = el("appts");
const apptTpl = el("apptTpl");

let me = null;
let myRole = "patient";

btnLogout?.addEventListener("click", async () => { await signOut(auth); window.location.href = "/"; });

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "/"; return; }
  me = user;

  const profRef = doc(db, "users", me.uid);
  const profSnap = await getDoc(profRef);
  if (profSnap.exists()) myRole = profSnap.data().role || "patient";
  else { await setDoc(profRef, { email: me.email || null, role: "patient", createdAt: new Date() }, { merge: true }); }

  whoamiSpan.textContent = `${myRole.toUpperCase()} • ${me.email || me.uid}`;

  const isDoctor = myRole === "doctor";

  // Doctor-only UI
  doctorOnlyFields.style.display = isDoctor ? "block" : "none";
  doctorFilters.style.display = isDoctor ? "flex" : "none";
  apptDoctorCard.style.display = isDoctor ? "block" : "none";

  // Patients are read-only: hide record form
  if (!isDoctor) {
    recordForm.style.display = "none";
    formMsg.textContent = "Patients can view records only.";
  }

  await Promise.all([loadRecords(), loadAppointments()]);
});

// ------- Records --------
recordForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMsg.textContent = "Saving...";

  // Only doctors can create/update
  const isDoctor = myRole === "doctor";
  if (!isDoctor) { formMsg.textContent = "Only doctors can create/update records."; return; }

  const id = recId.value.trim() || null;
  const title = (recTitle.value || "").trim();
  const notes = (recNotes.value || "").trim();
  if (!title || !notes) { formMsg.textContent = "Title and Notes are required."; return; }

  const patientId = (patientIdInput.value || "").trim();

  const payload = {
    title, notes,
    patientId,
    doctorId: me.uid,
    updatedAt: serverTimestamp(),
    ...(id ? {} : { createdAt: serverTimestamp() })
  };

  try {
    if (id) { await updateDoc(doc(db, "records", id), payload); formMsg.textContent = "Updated."; }
    else { await addDoc(collection(db, "records"), payload); formMsg.textContent = "Created."; }
    resetRecordForm();
    await loadRecords();
  } catch (e) {
    console.error(e);
    formMsg.textContent = e.message || String(e);
  }
});

btnCancel?.addEventListener("click", resetRecordForm);
btnClearFilter?.addEventListener("click", async () => { filterByPatient.value = ""; await loadRecords(); });
filterByPatient?.addEventListener("change", loadRecords);

async function loadRecords() {
  recordsDiv.innerHTML = "Loading...";
  const isDoctor = myRole === "doctor";

  try {
    let q;
    if (isDoctor) {
      const pid = (filterByPatient?.value || "").trim();
      q = pid
        ? query(collection(db, "records"), where("patientId", "==", pid))
        : query(collection(db, "records"));
    } else {
      q = query(collection(db, "records"), where("patientId", "==", me.uid));
    }

    const snap = await getDocs(q);
    recordsDiv.innerHTML = snap.empty ? "No records." : "";

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const node = recordTpl.content.cloneNode(true);
      node.querySelector(".title").textContent = data.title ?? "(untitled)";
      node.querySelector(".notes").textContent = data.notes ?? "";
      node.querySelector(".meta").textContent =
        `recordId: ${docSnap.id} • patientId: ${data.patientId || "-"} • doctorId: ${data.doctorId || "-"}`;

      const btnEdit = node.querySelector(".edit");
      const btnDel = node.querySelector(".del");

      // Patients read-only; Doctors can edit/delete
      const canEdit = isDoctor;
      const canDelete = isDoctor;

      if (!canEdit) btnEdit.style.display = "none";
      if (!canDelete) btnDel.style.display = "none";

      btnEdit.addEventListener("click", () => {
        document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
        recId.value = docSnap.id;
        recTitle.value = data.title || "";
        recNotes.value = data.notes || "";
        if (isDoctor) patientIdInput.value = data.patientId || "";
        formTitle.textContent = "Edit Record";
        btnCancel.style.display = "inline-block";
      });

      btnDel.addEventListener("click", async () => {
        if (!confirm("Delete this record?")) return;
        try { await deleteDoc(doc(db, "records", docSnap.id)); await loadRecords(); }
        catch (e) { alert(e.message); }
      });

      recordsDiv.appendChild(node);
    });
  } catch (err) {
    console.error("Firestore query failed:", err);
    recordsDiv.innerHTML = `<div class="muted">Error: ${err.message || err}</div>`;
  }
}

function resetRecordForm() {
  recId.value = "";
  recTitle.value = "";
  recNotes.value = "";
  if (patientIdInput) patientIdInput.value = "";
  formTitle.textContent = "New Record";
  btnCancel.style.display = "none";
  formMsg.textContent = "";
}

// ------- Appointments (doctor create; both view) --------
apptForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  apptMsg.textContent = "Saving...";
  const isDoctor = myRole === "doctor";
  if (!isDoctor) { apptMsg.textContent = "Only doctors can create appointments."; return; }

  const pid = (apptPatientUid.value || "").trim();
  const title = (apptTitle.value || "").trim();
  const when = (apptWhen.value || "").trim();
  const notes = (apptNotes.value || "").trim();

  if (!pid || !title || !when) { apptMsg.textContent = "Patient UID, Title and Date/Time are required."; return; }

  try {
    await addDoc(collection(db, "appointments"), {
      patientId: pid,
      doctorId: me.uid,
      title,
      notes: notes || null,
      when: new Date(when),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    apptMsg.textContent = "Appointment scheduled.";
    apptForm.reset();
    await loadAppointments();
  } catch (e) {
    apptMsg.textContent = e.message || String(e);
  }
});

async function loadAppointments() {
  apptsDiv.innerHTML = "Loading...";
  try {
    let q;
    if (myRole === "doctor") {
      q = query(collection(db, "appointments"));
    } else {
      q = query(collection(db, "appointments"), where("patientId", "==", me.uid));
    }
    const snap = await getDocs(q);
    apptsDiv.innerHTML = snap.empty ? "No appointments." : "";

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const node = apptTpl.content.cloneNode(true);
      node.querySelector(".title").textContent = d.title ?? "(untitled)";
      node.querySelector(".notes").textContent = d.notes ?? "";
      const whenTxt = d.when?.toDate ? d.when.toDate().toLocaleString() : new Date(d.when).toLocaleString();
      node.querySelector(".meta").textContent =
        `patientId: ${d.patientId || "-"} • doctorId: ${d.doctorId || "-"} • when: ${whenTxt}`;
      apptsDiv.appendChild(node);
    });
  } catch (e) {
    console.error(e);
    apptsDiv.innerHTML = `<div class="muted">Error: ${e.message || e}</div>`;
  }
}
